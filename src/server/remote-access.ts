/**
 * Remote access (E21, 2026-11-01): who may open LangHarness from another
 * device. OFF by default, and then nothing changes: the server answers this
 * computer only, as it always has.
 *
 * ON, for Tailscale Serve: Serve connects from this computer, so the server
 * keeps listening on 127.0.0.1 in both states and nothing binds to the LAN.
 * Every request must then be the packaged desktop window or carry a paired
 * device's cookie. Only the pairing page, its one POST and the static assets
 * are public. Serve's identity headers are NOT proof of access: Funnel and
 * tagged-device traffic arrives without them, so a missing header grants
 * nothing (fail closed).
 *
 * Pure: no file and no clock here. The store (remote-access-store.ts) keeps
 * the file and the codes; the proxy and the routes call these rules.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { loopbackHost } from "./desktop-access.ts";

export const DEVICE_COOKIE = "lh_device";
/** A paired device stays signed in this long, unless it is revoked first. */
export const DEVICE_SESSION_DAYS = 180;
/** A pairing code works this long, and for this many wrong tries. */
export const PAIRING_CODE_MINUTES = 5;
export const PAIRING_MAX_FAILURES = 5;
export const PAIRING_CODE_DIGITS = 6;

/** `desktop:dev` listens here; the fallback when no port is known. */
const DEFAULT_PORT = 3010;

export const REMOTE_OFF_MESSAGE = "Remote access is off. Turn it on in Settings → Devices, on this computer.";
export const ONLY_THIS_COMPUTER_API = "The LangHarness API only answers this computer.";
export const ONLY_THIS_COMPUTER_PAGE = "LangHarness only answers this computer.";
export const DESKTOP_ONLY_API = "Desktop API access requires the trusted LearnHarness window.";
export const ADDRESS_NOT_ALLOWED = "This address is not allowed. Use this computer’s Tailscale name.";

/**
 * Headers that only a proxy sends. The x-forwarded-* family is deliberately not
 * here: Next sets all four on every request the app sees (its base server fills
 * each one that is missing), so they prove nothing. addressedBy reads the host
 * names instead. Tailscale's identity headers come only with tailnet traffic,
 * so their absence proves nothing either; their presence refuses when remote
 * access is off.
 */
const PROXY_HEADERS = [
	"forwarded",
	"x-real-ip",
	"tailscale-user-login",
	"tailscale-user-name",
	"tailscale-user-profile-pic",
	"tailscale-app-capabilities",
];

export type AccessInput = {
	pathname: string;
	method: string;
	host: string | null;
	headers: Headers;
	/** The owner's switch (access.json). */
	enabled: boolean;
	/** The packaged desktop window: its per-launch secret matched. */
	desktopWindow: boolean;
	/** The pre-remote desktop check (desktopAPIAuthorized): with LH_DESKTOP_SERVER=1 the API needs the secret. */
	desktopApiOk: boolean;
	/** A live, unexpired paired-device session was presented. */
	paired: boolean;
};

export type AccessDecision = { action: "allow" } | { action: "refuse"; message: string } | { action: "pair" };

/** Whether a request came through a reverse proxy (Tailscale Serve, a tunnel, anything). */
export function proxied(headers: Headers): boolean {
	return PROXY_HEADERS.some((name) => headers.has(name));
}

/**
 * Every name the request was addressed by: its Host, and the original Host when
 * Next's router passed it on (x-forwarded-host). The app worker sees the router's
 * own Host, so the original name has to be read from that header, and both must pass.
 */
export function addressedBy(input: Pick<AccessInput, "host" | "headers">): (string | null)[] {
	const original = input.headers.get("x-forwarded-host");
	return original ? [input.host, original] : [input.host];
}

/** A MagicDNS name of a tailnet: `<machine>.<tailnet>.ts.net`, with or without a port. */
export function tailnetHost(host: string | null): boolean {
	if (!host) return false;
	const name = (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? "")).toLowerCase();
	return name.endsWith(".ts.net");
}

/** Public while remote access is on: the pairing page, the one request that pairs, and static assets. */
export function publicPath(pathname: string, method: string): boolean {
	if (pathname === "/pair") return method === "GET" || method === "HEAD";
	if (pathname === "/api/access/pair") return method === "POST";
	return (
		pathname.startsWith("/_next/") ||
		pathname.startsWith("/icons/") ||
		pathname === "/favicon.ico" ||
		pathname === "/apple-icon.png" ||
		pathname === "/manifest.webmanifest"
	);
}

/**
 * The one decision for every page and API request.
 *
 * OFF: the rules as they were, plus two refusals. A request that a proxy
 * carried is refused (Serve running while the switch is off must not let
 * anyone in), and a non-loopback Host is refused on pages too.
 *
 * ON: the Host must be this computer or a tailnet name. Then the desktop
 * window or a paired device passes, and everything else is sent to pairing.
 */
export function decideAccess(input: AccessInput): AccessDecision {
	const api = input.pathname === "/api" || input.pathname.startsWith("/api/");
	const names = addressedBy(input);
	if (!input.enabled) {
		if (proxied(input.headers)) return { action: "refuse", message: REMOTE_OFF_MESSAGE };
		if (!names.every((name) => loopbackHost(name))) return { action: "refuse", message: api ? ONLY_THIS_COMPUTER_API : ONLY_THIS_COMPUTER_PAGE };
		if (api && !input.desktopApiOk) return { action: "refuse", message: DESKTOP_ONLY_API };
		return { action: "allow" };
	}
	if (!names.every((name) => loopbackHost(name) || tailnetHost(name))) return { action: "refuse", message: ADDRESS_NOT_ALLOWED };
	if (input.desktopWindow) return { action: "allow" };
	if (publicPath(input.pathname, input.method)) return { action: "allow" };
	if (input.paired) return { action: "allow" };
	return { action: "pair" };
}

/** The value of one cookie from a Cookie header, or null. */
export function readCookie(headers: Headers, name: string): string | null {
	const raw = headers.get("cookie");
	if (!raw) return null;
	for (const part of raw.split(";")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
	}
	return null;
}

/** A base for a request URL that is not absolute: the dev router can pass a bare path, and `new URL(path)` would throw. */
const URL_BASE = "http://127.0.0.1";

/** Served over HTTPS, either directly or through a proxy that says so. */
export function secureRequest(url: string, headers: Headers): boolean {
	return new URL(url, URL_BASE).protocol === "https:" || headers.get("x-forwarded-proto") === "https";
}

/** The Set-Cookie line that signs a device in. HttpOnly, so page scripts never read it. */
export function deviceCookie(token: string, secure: boolean): string {
	const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${DEVICE_SESSION_DAYS * 86_400}`];
	if (secure) attributes.push("Secure");
	return [`${DEVICE_COOKIE}=${token}`, ...attributes].join("; ");
}

/** The Set-Cookie line that clears the device cookie. */
export function clearDeviceCookie(secure: boolean): string {
	const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
	if (secure) attributes.push("Secure");
	return [`${DEVICE_COOKIE}=`, ...attributes].join("; ");
}

/** Tokens and codes are stored as SHA-256 digests, never as the value itself. */
export function hashSecret(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/** A typed pairing code: digits only, spaces and dashes ignored. Null when it is not a code. */
export function normalizeCode(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const digits = input.replace(/[\s-]/g, "");
	return new RegExp(`^\\d{${PAIRING_CODE_DIGITS}}$`).test(digits) ? digits : null;
}

/** `482913` → `482 913`, for reading aloud and for the Settings display. */
export function formatCode(code: string): string {
	const half = Math.floor(code.length / 2);
	return `${code.slice(0, half)} ${code.slice(half)}`;
}

/** A readable default name for a device, from its browser's user agent. The owner can rename it on the pairing page. */
export function deviceNameFromAgent(agent: string | null): string {
	const ua = agent ?? "";
	if (/iPad/.test(ua)) return "iPad";
	if (/iPhone/.test(ua)) return "iPhone";
	if (/Android/.test(ua)) return "Android device";
	if (/Macintosh/.test(ua)) return "Mac or iPad";
	if (/Windows/.test(ua)) return "Windows PC";
	if (/Linux/.test(ua)) return "Linux computer";
	return "Browser";
}

/** A name the owner typed: no control characters, 40 characters at most. */
export function cleanDeviceName(input: unknown, fallback: string): string {
	if (typeof input !== "string") return fallback;
	const name = input.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
	return name || fallback;
}

/** The port the app is listening on, for the `tailscale serve` command: the one the request came in on, else PORT, else 3010. */
export function listeningPort(url: string, env: Record<string, string | undefined> = process.env): number {
	return Number(new URL(url, URL_BASE).port) || Number(env.PORT) || DEFAULT_PORT;
}
