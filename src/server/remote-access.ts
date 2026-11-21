/**
 * Remote access (E21, 2026-11-01): who may open Lanna from another
 * device. OFF by default, and then nothing changes: the server answers this
 * computer only, as it always has.
 *
 * ON, for Tailscale Serve: Serve connects from this computer, so the server
 * keeps listening on 127.0.0.1 in both states and nothing binds to the LAN.
 * A request that names only this computer and came through no proxy gets the
 * same answer as with the switch off: the browser on the PC, the packaged
 * window and the dev server pass. A request that came through the proxy (a
 * phone over Serve) must carry a paired device's cookie, or the packaged
 * window's secret, which a phone never has. Only the pairing page, its one POST
 * and the static assets are public.
 * A request is proxied when it carries a Tailscale identity header, Forwarded or
 * X-Real-IP, or names a tailnet host in Host or X-Forwarded-Host. Such a header
 * only makes a request stricter, never looser. Serve's identity headers are not
 * proof of access by themselves: Funnel and tagged-device traffic may arrive
 * without them, so the tailnet name catches them. A Serve that rewrote Host to
 * loopback and sent no identity header would look like this computer (see
 * docs/research/remote-access.md).
 *
 * Pure: no file and no clock here. The store (remote-access-store.ts) keeps
 * the file and the codes; the proxy and the routes call these rules.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { loopbackHost } from "./desktop-access.ts";

export const DEVICE_COOKIE = "lanna_device";
/** A paired device stays signed in this long, unless it is revoked first. */
export const DEVICE_SESSION_DAYS = 180;
/** A pairing code works this long, and for this many wrong tries. */
export const PAIRING_CODE_MINUTES = 5;
export const PAIRING_MAX_FAILURES = 5;
export const PAIRING_CODE_DIGITS = 6;

/** `desktop:dev` listens here; the fallback when no port is known. */
const DEFAULT_PORT = 3010;

const REMOTE_OFF_MESSAGE = "Remote access is off. Turn it on in Settings → Devices, on this computer.";
const ONLY_THIS_COMPUTER_API = "The Lanna API only answers this computer.";
const ONLY_THIS_COMPUTER_PAGE = "Lanna only answers this computer.";
const DESKTOP_ONLY_API = "Desktop API access requires the trusted Lanna window.";
const ADDRESS_NOT_ALLOWED = "This address is not allowed. Use this computer’s Tailscale name.";
const PUBLIC_NOT_CONFIGURED =
	"The public address is not set up: LANNA_PUBLIC_HOST must be a host name, and LANNA_PROXY_SECRET at least 32 characters.";
const ONLY_THROUGH_PROXY = "This address answers only through its reverse proxy.";
const PUBLIC_ADDRESS_MISMATCH = "This address is not allowed. Use the public address.";
const HTTPS_REQUIRED = "This address needs HTTPS.";
const WEB_ACCESS_OFF =
	"Web access is off. Turn it on in Settings → Devices, or run npm run web:password on the server.";
const CROSS_ORIGIN = "This request did not come from Lanna’s own page.";

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

export const PROXY_SECRET_HEADER = "x-lanna-proxy-secret";
export const PROXY_SECRET_MIN_LENGTH = 32;

export type PublicMode = { host: string; secretConfigured: boolean; secretOk: boolean };

export type AccessInput = {
	pathname: string;
	method: string;
	host: string | null;
	headers: Headers;
	/** The owner's switch (access.json). */
	enabled: boolean;
	/** The packaged desktop window: its per-launch secret matched. */
	desktopWindow: boolean;
	/** The pre-remote desktop check (desktopAPIAuthorized): with LANNA_DESKTOP_SERVER=1 the API needs the secret. */
	desktopApiOk: boolean;
	/** A live, unexpired paired-device session was presented. */
	paired: boolean;
	publicMode?: PublicMode | null;
};

type AccessDecision =
	| { action: "allow" }
	| { action: "refuse"; message: string }
	| { action: "pair" }
	| { action: "login" };

/** Whether a request came through a reverse proxy (Tailscale Serve, a tunnel, anything). */
function proxied(headers: Headers): boolean {
	return PROXY_HEADERS.some((name) => headers.has(name));
}

/**
 * Every name the request was addressed by: its Host, and the original Host when
 * Next's router passed it on (x-forwarded-host). The app worker sees the router's
 * own Host, so the original name has to be read from that header, and both must pass.
 */
function addressedBy(input: Pick<AccessInput, "host" | "headers">): (string | null)[] {
	const original = input.headers.get("x-forwarded-host");
	return original ? [input.host, original] : [input.host];
}

/** The request came from this computer's own window, not through Serve or another proxy. */
export function fromThisComputer(headers: Headers, host: string | null): boolean {
	return !proxied(headers) && addressedBy({ host, headers }).every((name) => loopbackHost(name));
}

/** A MagicDNS name of a tailnet: `<machine>.<tailnet>.ts.net`, with or without a port. */
export function tailnetHost(host: string | null): boolean {
	if (!host) return false;
	const name = (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : (host.split(":")[0] ?? "")).toLowerCase();
	return name.endsWith(".ts.net");
}

function staticPath(pathname: string): boolean {
	return (
		pathname.startsWith("/_next/") ||
		pathname.startsWith("/icons/") ||
		pathname === "/favicon.ico" ||
		pathname === "/apple-icon.png" ||
		pathname === "/manifest.webmanifest"
	);
}

/** Public while remote access is on: the pairing page, the one request that pairs, and static assets. */
export function publicPath(pathname: string, method: string): boolean {
	if (pathname === "/pair") return method === "GET" || method === "HEAD";
	if (pathname === "/api/access/pair") return method === "POST";
	return staticPath(pathname);
}

export function publicWebPath(pathname: string, method: string): boolean {
	if (pathname === "/login") return method === "GET" || method === "HEAD";
	if (pathname === "/api/access/login") return method === "POST";
	return staticPath(pathname);
}

export function validPublicHost(host: string): boolean {
	return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

/** Next 16 does not hand the TCP peer to proxy.ts, and every x-forwarded-* header is either filled in by Next or sent by the client, so only a secret the reverse proxy adds can prove a request came through it. */
export function publicModeFrom(
	headers: Headers,
	env: Record<string, string | undefined> = process.env,
): PublicMode | null {
	const host = env.LANNA_PUBLIC_HOST?.trim().toLowerCase();
	if (!host) return null;
	const secret = env.LANNA_PROXY_SECRET ?? "";
	const secretConfigured = secret.length >= PROXY_SECRET_MIN_LENGTH;
	const supplied = headers.get(PROXY_SECRET_HEADER);
	return {
		host,
		secretConfigured,
		secretOk: secretConfigured && supplied !== null && sameHash(hashSecret(supplied), hashSecret(secret)),
	};
}

export function originAllowed(origin: string | null, host: string): boolean {
	return origin === `https://${host}`;
}

function changesState(method: string): boolean {
	return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/** nginx sends the upstream's own name (127.0.0.1:3010) as Host unless told otherwise, which would look like this computer, so no request at the public address is treated as local. */
function decidePublic(input: AccessInput, mode: PublicMode): AccessDecision {
	if (!validPublicHost(mode.host) || !mode.secretConfigured)
		return { action: "refuse", message: PUBLIC_NOT_CONFIGURED };
	if (!mode.secretOk) return { action: "refuse", message: ONLY_THROUGH_PROXY };
	if (!addressedBy(input).every((name) => name?.toLowerCase() === mode.host))
		return { action: "refuse", message: PUBLIC_ADDRESS_MISMATCH };
	if (input.headers.get("x-forwarded-proto") !== "https") return { action: "refuse", message: HTTPS_REQUIRED };
	if (!input.enabled) return { action: "refuse", message: WEB_ACCESS_OFF };
	if (changesState(input.method) && !originAllowed(input.headers.get("origin"), mode.host))
		return { action: "refuse", message: CROSS_ORIGIN };
	if (publicWebPath(input.pathname, input.method)) return { action: "allow" };
	return input.paired ? { action: "allow" } : { action: "login" };
}

export function safeNext(path: string | null | undefined): string {
	if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || /[\u0000-\u001f]/.test(path))
		return "/";
	if (path === "/login" || path.startsWith("/login?") || path.startsWith("/pair")) return "/";
	return path;
}

/** nginx's $proxy_add_x_forwarded_for appends the peer to whatever X-Forwarded-For the client sent, so only the last entry is the proxy's. */
export function clientAddress(headers: Headers): string {
	const last = (headers.get("x-forwarded-for") ?? "").split(",").pop()?.trim() ?? "";
	return last ? last.slice(0, 64) : "unknown";
}

/**
 * The one decision for every page and API request.
 *
 * This computer's own request (no proxy marked it, and every name it was
 * addressed by is loopback) gets the same answer with the switch on or off:
 * pages pass, and the API passes when the desktop check does. Nothing asks
 * this computer's browser for a code (E21, 2026-11-01).
 *
 * Any other request came through a proxy or names a tailnet host. OFF: a request
 * a proxy marked is refused (Serve running while the switch is off must not let
 * anyone in), and so is any other name. ON: every name must be this computer or
 * a tailnet name. Then the desktop window, the public pairing and static paths,
 * or a paired device passes; everything else is sent to pairing.
 */
export function decideAccess(input: AccessInput): AccessDecision {
	const api = input.pathname === "/api" || input.pathname.startsWith("/api/");
	const names = addressedBy(input);
	if (input.publicMode && !names.some((name) => tailnetHost(name))) return decidePublic(input, input.publicMode);
	const viaProxy = proxied(input.headers);
	if (fromThisComputer(input.headers, input.host)) {
		if (api && !input.desktopApiOk) return { action: "refuse", message: DESKTOP_ONLY_API };
		return { action: "allow" };
	}
	if (!input.enabled) {
		if (viaProxy) return { action: "refuse", message: REMOTE_OFF_MESSAGE };
		return { action: "refuse", message: api ? ONLY_THIS_COMPUTER_API : ONLY_THIS_COMPUTER_PAGE };
	}
	if (!names.every((name) => loopbackHost(name) || tailnetHost(name)))
		return { action: "refuse", message: ADDRESS_NOT_ALLOWED };
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
	const name = input
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim()
		.slice(0, 40);
	return name || fallback;
}

/** The port the app is listening on, for the `tailscale serve` command: the one the request came in on, else PORT, else 3010. */
export function listeningPort(url: string, env: Record<string, string | undefined> = process.env): number {
	return Number(new URL(url, URL_BASE).port) || Number(env.PORT) || DEFAULT_PORT;
}
