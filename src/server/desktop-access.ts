import { timingSafeEqual } from "node:crypto";

/** Per-launch desktop HTTP capability. This is not an OS-user malware
 * boundary and is not an OAuth credential. Browser-only mode is unchanged. */
export function desktopAPIAuthorized(
	headers: Headers,
	env: Record<string, string | undefined> = process.env,
): boolean {
	if (env.LH_DESKTOP_SERVER !== "1" && !env.LH_DESKTOP_API_SECRET) return true;
	return desktopWindowRequest(headers, env);
}

/** The packaged desktop window (E21): the per-launch secret matched, whatever LH_DESKTOP_SERVER says. Dev and browser runs have no secret, so no request is the window by this test. */
export function desktopWindowRequest(
	headers: Headers,
	env: Record<string, string | undefined> = process.env,
): boolean {
	const expected = env.LH_DESKTOP_API_SECRET;
	if (!expected || expected.length < 64) return false;
	const supplied = headers.get("x-learnharness-desktop");
	if (!supplied) return false;
	const actual = Buffer.from(supplied);
	const wanted = Buffer.from(expected);
	return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/** LangHarness (2026-10-26): API requests must name this machine. Refuses
 * other devices on the network and DNS-rebinding pages, whose Host header
 * carries their own name. A request with no Host (tests, raw sockets that
 * already reached the loopback bind) passes. */
export function loopbackHost(host: string | null): boolean {
	if (!host) return true;
	const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
	return name === "localhost" || name === "127.0.0.1" || name === "[::1]";
}
