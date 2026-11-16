import { NextResponse, type NextRequest } from "next/server";
import { defaultProfile, isLanguageProfile } from "./config.ts";
import {
	DEVICE_LANGUAGE_COOKIE,
	deviceLanguageCookie,
	languageGone,
	SHOWN_LANGUAGE_HEADER,
} from "./src/core/language-guard.ts";
import { desktopAPIAuthorized, desktopWindowRequest } from "./src/server/desktop-access.ts";
import {
	DEVICE_COOKIE,
	decideAccess,
	publicModeFrom,
	readCookie,
	secureRequest,
	tailnetHost,
} from "./src/server/remote-access.ts";
import { readAccess, resolveDevice } from "./src/server/remote-access-store.ts";

const NO_STORE = { "Cache-Control": "no-store" };

/** Every page and API request (E21). Remote access off: the rules LangHarness always had, plus refusals for proxied requests and non-loopback hosts. Remote access on: this computer's own requests get the same answer as with it off; a request that came through the proxy needs a paired device, and everything else goes to /pair. Static assets are skipped by the matcher. Applies to SSE and the spending and settings routes too. No public callback or worker bypass: internal jobs call server functions, and any legitimate self-HTTP request must carry the private capability. */
export async function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	const headers = request.headers;
	const access = readAccess();
	const token = access.enabled ? readCookie(headers, DEVICE_COOKIE) : null;
	const device = token ? await resolveDevice(token) : null;
	const publicMode = publicModeFrom(headers);
	const decision = decideAccess({
		pathname,
		method: request.method,
		host: headers.get("host"),
		headers,
		enabled: access.enabled,
		desktopWindow: desktopWindowRequest(headers),
		desktopApiOk: desktopAPIAuthorized(headers),
		paired: device !== null,
		publicMode,
	});
	if (decision.action === "allow") {
		const gone = languageGone(
			{ method: request.method, pathname, shown: headers.get(SHOWN_LANGUAGE_HEADER) },
			isLanguageProfile,
		);
		if (gone) return NextResponse.json(gone, { status: 409, headers: NO_STORE });
		const next = NextResponse.next();
		if (
			!pathname.startsWith("/api/") &&
			request.method === "GET" &&
			!isLanguageProfile(readCookie(headers, DEVICE_LANGUAGE_COOKIE))
		) {
			next.headers.append("set-cookie", deviceLanguageCookie(defaultProfile(), secureRequest(request.url, headers)));
		}
		return next;
	}
	const api = pathname.startsWith("/api/");
	if (decision.action === "login") {
		if (api || request.method !== "GET") {
			return NextResponse.json(
				{ error: "login_required", message: "Sign in first." },
				{ status: 401, headers: NO_STORE },
			);
		}
		const redirect = NextResponse.redirect(
			new URL(
				`/login?next=${encodeURIComponent(`${pathname}${search}`)}`,
				`https://${publicMode?.host ?? headers.get("host")}`,
			),
			307,
		);
		redirect.headers.set("cache-control", "no-store");
		return redirect;
	}
	if (decision.action === "pair") {
		if (api || request.method !== "GET") {
			return NextResponse.json(
				{
					error: "pairing_required",
					message: "Pair this device first. Open /pair in LangHarness and enter the code from the computer.",
				},
				{ status: 401, headers: NO_STORE },
			);
		}
		// Next's proxy adapter parses Location without a base, so it must be absolute. The
		// scheme follows the name: Serve publishes a tailnet name over HTTPS, and this server
		// is plain HTTP behind it. request.url is not used: under the dev router it can be a bare path.
		const host = headers.get("host") ?? request.nextUrl.host;
		const scheme = tailnetHost(host) ? "https" : "http";
		const location = new URL(`/pair?next=${encodeURIComponent(`${pathname}${search}`)}`, `${scheme}://${host}`);
		const redirect = NextResponse.redirect(location, 307);
		redirect.headers.set("cache-control", "no-store");
		return redirect;
	}
	if (api) return NextResponse.json({ error: decision.message }, { status: 403, headers: NO_STORE });
	return new NextResponse(decision.message, {
		status: 403,
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
	});
}

// Static assets, the Next build output and the install icons never reach the gate.
export const config = { matcher: "/((?!_next/|icons/|favicon.ico|apple-icon.png|manifest.webmanifest).*)" };
