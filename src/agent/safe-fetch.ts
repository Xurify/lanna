import * as dns from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import { Readable, Transform, pipeline, type TransformCallback } from "node:stream";
import * as zlib from "node:zlib";

export class SafeFetchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SafeFetchError";
	}
}

/** Reserved ranges from IANA's IPv4 and IPv6 special-purpose address registries (RFC 6890). */
const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.88.99.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
] as const) {
	BLOCKED.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
	["::", 96],
	["64:ff9b:1::", 48],
	["100::", 64],
	["2001::", 23],
	["2001:db8::", 32],
	["2002::", 16],
	["fc00::", 7],
	["fe80::", 10],
	["fec0::", 10],
	["ff00::", 8],
] as const) {
	BLOCKED.addSubnet(address, prefix, "ipv6");
}

/** The IPv4 address an IPv6 address carries: IPv4-mapped (::ffff:a.b.c.d) and the NAT64 prefix (RFC 6052). */
function embeddedIPv4(ip: string): string | null {
	// The URL parser writes every IPv6 form in one canonical shape, so one pattern covers them all.
	const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
	const match = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
	if (!match) return null;
	const high = Number.parseInt(match[1]!, 16);
	const low = Number.parseInt(match[2]!, 16);
	return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

/** True only for an address on the public internet. */
export function isPublicAddress(address: string): boolean {
	const ip = address.replace(/^\[|\]$/g, "").split("%")[0] ?? "";
	const family = net.isIP(ip);
	if (family === 0) return false;
	if (family === 4) return !BLOCKED.check(ip, "ipv4");
	const embedded = embeddedIPv4(ip);
	if (embedded) return isPublicAddress(embedded);
	return !BLOCKED.check(ip, "ipv6");
}

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet"];

export type Resolver = (host: string) => Promise<string[]>;
export interface TransportRequest {
	url: URL;
	method: string;
	headers: Record<string, string>;
	body?: Uint8Array | string;
	addresses: string[];
	signal: AbortSignal;
}
export interface TransportResponse {
	status: number;
	statusText: string;
	headers: Headers;
	body: Readable | null;
}
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

const resolveWithSystem: Resolver = async (host) => (await dns.lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(raw)) {
		if (Array.isArray(value)) for (const item of value) headers.append(name, item);
		else if (value !== undefined) headers.set(name, value);
	}
	return headers;
}

/** Connects to the addresses it was given and to nothing else, so a name that resolves differently a moment later cannot reach another host. */
const connectPinned: Transport = (request) =>
	new Promise((resolve, reject) => {
		const client = request.url.protocol === "https:" ? https : http;
		const list = request.addresses.map((address) => ({ address, family: net.isIP(address) }));
		const outgoing = client.request(
			request.url,
			{
				method: request.method,
				headers: request.headers,
				signal: request.signal,
				// Node calls lookup with `all: true` when it tries several addresses in turn (autoSelectFamily).
				lookup: ((_host: string, options: { all?: boolean }, callback: (error: Error | null, address: unknown, family?: number) => void) => {
					if (options.all) callback(null, list);
					else callback(null, list[0]!.address, list[0]!.family);
				}) as never,
			},
			(incoming) => resolve({ status: incoming.statusCode ?? 0, statusText: incoming.statusMessage ?? "", headers: toHeaders(incoming.headers), body: incoming }),
		);
		outgoing.on("error", reject);
		if (request.body !== undefined) outgoing.write(request.body);
		outgoing.end();
	});

/** What the guard calls out to. Tests replace these; nothing else does. */
export const safeFetchSeams: { resolve: Resolver; transport: Transport; isAllowedAddress: (address: string) => boolean; allowedPorts: Set<string> } = {
	resolve: resolveWithSystem,
	transport: connectPinned,
	isAllowedAddress: isPublicAddress,
	allowedPorts: new Set(["", "80", "443"]),
};

export interface SafeFetchOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: Uint8Array | string;
	signal?: AbortSignal;
	/** Decoded bytes the response may hold. */
	maxBytes?: number;
	/** The whole request, redirects and body included. */
	timeoutMs?: number;
	maxRedirects?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

/** Throws unless the URL is plain http(s) to a public host; returns the addresses to connect to. */
export async function assertPublicUrl(input: string | URL): Promise<{ url: URL; addresses: string[] }> {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new SafeFetchError(`invalid URL "${String(input)}"`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("only http(s) URLs are supported");
	if (url.username || url.password) throw new SafeFetchError("URLs with a user name or password are not fetched");
	if (!safeFetchSeams.allowedPorts.has(url.port)) throw new SafeFetchError("only the standard web ports (80 and 443) are fetched");
	const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
	if (!host) throw new SafeFetchError("the URL has no host");
	const literal = net.isIP(host) !== 0;
	if (!literal && (!host.includes(".") || host === "localhost" || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)))) {
		throw new SafeFetchError("internal host names are not fetched");
	}
	const addresses = literal ? [host] : await safeFetchSeams.resolve(host);
	if (addresses.length === 0) throw new SafeFetchError(`${host} did not resolve`);
	if (!addresses.every((address) => safeFetchSeams.isAllowedAddress(address))) {
		throw new SafeFetchError("that address is not on the public internet");
	}
	return { url, addresses };
}

function capBytes(maxBytes: number): Transform {
	let seen = 0;
	return new Transform({
		transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
			seen += chunk.length;
			if (seen > maxBytes) callback(new SafeFetchError("response too large"));
			else callback(null, chunk);
		},
	});
}

function decoderFor(encoding: string): Transform | null {
	switch (encoding.trim().toLowerCase()) {
		case "":
		case "identity":
			return null;
		case "gzip":
		case "x-gzip":
			return zlib.createGunzip();
		case "deflate":
			return zlib.createInflate();
		case "br":
			return zlib.createBrotliDecompress();
		default:
			throw new SafeFetchError(`unsupported content-encoding "${encoding}"`);
	}
}

/**
 * A fetch for URLs that someone other than the app chose. It refuses anything
 * that is not plain http(s) on the standard ports to a public address, checks
 * every redirect the same way, connects only to the addresses it checked, and
 * caps the redirects, the time and the decoded size.
 */
export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS), ...(options.signal ? [options.signal] : [])]);
	let method = (options.method ?? "GET").toUpperCase();
	let body = options.body;
	let target: string | URL = input;
	for (let hop = 0; ; hop++) {
		const { url, addresses } = await assertPublicUrl(target);
		signal.throwIfAborted();
		const response = await safeFetchSeams.transport({
			url,
			method,
			headers: { "accept-encoding": "gzip, deflate, br", ...options.headers },
			body,
			addresses,
			signal,
		});
		const location = response.headers.get("location");
		if (REDIRECT_STATUSES.has(response.status) && location) {
			response.body?.destroy();
			if (hop >= (options.maxRedirects ?? DEFAULT_MAX_REDIRECTS)) throw new SafeFetchError("too many redirects");
			target = new URL(location, url);
			if (response.status !== 307 && response.status !== 308 && method !== "GET" && method !== "HEAD") {
				method = "GET";
				body = undefined;
			}
			continue;
		}
		const headers = new Headers(response.headers);
		const declared = Number(headers.get("content-length") ?? 0);
		if (!headers.get("content-encoding") && declared > maxBytes) {
			response.body?.destroy();
			throw new SafeFetchError("response too large");
		}
		const decoder = decoderFor(headers.get("content-encoding") ?? "");
		headers.delete("content-encoding");
		headers.delete("content-length");
		let payload: ReadableStream | null = null;
		if (response.body && !NO_BODY_STATUSES.has(response.status) && method !== "HEAD") {
			const source = response.body;
			const limited = capBytes(maxBytes);
			if (decoder) pipeline(source, decoder, limited, () => {});
			else pipeline(source, limited, () => {});
			payload = Readable.toWeb(limited) as ReadableStream;
		} else response.body?.destroy();
		const result = new Response(payload, { status: response.status, statusText: response.statusText, headers });
		Object.defineProperty(result, "url", { value: url.href });
		return result;
	}
}
