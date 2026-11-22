import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT_MS = 30_000;
const TARGET_CHECK_MS = 800;

const NOT_INSTALLED =
	"Tailscale is not installed on this computer. Install it from tailscale.com/download, sign it in, then try again.";
const NOT_RUNNING = "Tailscale is not running on this computer. Start Tailscale, then try again.";
const NOT_ENABLED =
	"Tailscale Serve is not enabled for your tailnet. Run the command below in a terminal once, open the link it prints, then try again.";
const NOT_SIGNED_IN = "Tailscale is not signed in on this computer. Sign in to Tailscale, then try again.";
const OLD_VERSION =
	"This Tailscale version does not take --bg. Update Tailscale, or run `tailscale serve --help` and use the form it lists.";
const UNKNOWN_FLAG = /unknown flag|flag provided but not defined|unrecognized flag|invalid flag/i;
const NOT_RUNNING_PATTERN =
	/not running|doesn't appear to be running|failed to connect to local tailscaled|tailscale is stopped|tailscaled not running|daemon not running|no backend|cannot connect to tailscale/i;

export type ServeState = {
	installed: boolean;
	running: boolean;
	serving: boolean;
	url: string | null;
	port: number | null;
	error?: string | null;
};
export type ServeStart = { ok: true; state: ServeState } | { ok: false; message: string };

type CliResult = { found: true; ok: boolean; output: string } | { found: false };

function candidateBinaries(): string[] {
	const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
	const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
	if (process.platform === "win32") {
		return [
			path.join(programFiles, "Tailscale", "tailscale.exe"),
			path.join(programFilesX86, "Tailscale", "tailscale.exe"),
			"tailscale.exe",
			"tailscale",
		];
	}
	if (process.platform === "darwin") {
		return ["/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/usr/local/bin/tailscale", "tailscale"];
	}
	return ["/usr/bin/tailscale", "/usr/local/bin/tailscale", "tailscale"];
}

function installedBinaries(): string[] {
	return candidateBinaries().filter((candidate) => !path.isAbsolute(candidate) || fs.existsSync(candidate));
}

async function runTailscale(args: string[]): Promise<CliResult> {
	for (const binary of installedBinaries()) {
		try {
			const { stdout, stderr } = await execFileAsync(binary, args, { timeout: CLI_TIMEOUT_MS, windowsHide: true });
			return { found: true, ok: true, output: `${stdout}${stderr}`.trim() };
		} catch (error) {
			const failure = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
			if (failure.code === "ENOENT") continue;
			if (failure.killed) {
				return {
					found: true,
					ok: false,
					output: `Tailscale did not answer within ${CLI_TIMEOUT_MS / 1000} seconds.`,
				};
			}
			const output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim();
			return { found: true, ok: false, output: output || failure.message };
		}
	}
	return { found: false };
}

export function serveUrl(text: string): string | null {
	const match = text.match(/https:\/\/[^\s/]+\.ts\.net\/?/i);
	return match ? match[0] : null;
}

export function serveMappedPort(text: string): number | null {
	const match = text.match(/(?:127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0):(\d+)(?!\d)/);
	return match ? Number(match[1]) : null;
}

export function servesPort(text: string, port: number): boolean {
	return serveMappedPort(text) === port;
}

export function servePointsElsewhere(state: ServeState, port: number): boolean {
	return state.port !== null && state.port !== port;
}

export function portAnswers(port: number, timeoutMs = TARGET_CHECK_MS): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({ host: "127.0.0.1", port });
		const finish = (answer: boolean) => {
			socket.removeAllListeners();
			socket.destroy();
			resolve(answer);
		};
		socket.setTimeout(timeoutMs, () => finish(false));
		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
	});
}

function loginUrl(text: string): string | null {
	const match = text.match(/https:\/\/login\.tailscale\.com\/[^\s"'<>]+/i);
	return match ? match[0].replace(/[.,)]+$/, "") : null;
}

export function serveFailureMessage(output: string): string {
	const text = output.trim();
	if (UNKNOWN_FLAG.test(text)) return OLD_VERSION;
	const enable = loginUrl(text);
	if (enable) return `Tailscale Serve is not enabled for your tailnet. Open ${enable}, turn it on, then try again.`;
	if (/not enabled|serve is off/i.test(text)) return NOT_ENABLED;
	if (NOT_RUNNING_PATTERN.test(text)) return NOT_RUNNING;
	if (/not logged in|logged out|needs login|login required|no node key/i.test(text)) return NOT_SIGNED_IN;
	return text.slice(0, 400) || "Tailscale did not start Serve.";
}

export async function serveState(port: number): Promise<ServeState> {
	const status = await runTailscale(["serve", "status"]);
	if (!status.found) return { installed: false, running: false, serving: false, url: null, port: null, error: null };
	if (!status.ok) {
		const message = serveFailureMessage(status.output);
		const notRunning = NOT_RUNNING_PATTERN.test(status.output);
		return { installed: true, running: !notRunning, serving: false, url: null, port: null, error: message };
	}
	const url = serveUrl(status.output);
	const mappedPort = serveMappedPort(status.output);
	const serving = url !== null && mappedPort === port;
	return {
		installed: true,
		running: true,
		serving,
		url: serving ? url : null,
		port: url ? mappedPort : null,
		error: null,
	};
}

async function startTailscaleServe(port: number): Promise<CliResult> {
	const started = await runTailscale(["serve", "--bg", "--yes", String(port)]);
	if (!started.found || started.ok || !UNKNOWN_FLAG.test(started.output)) return started;
	return runTailscale(["serve", "--bg", String(port)]);
}

export async function startServe(port: number): Promise<ServeStart> {
	const started = await startTailscaleServe(port);
	if (!started.found) return { ok: false, message: NOT_INSTALLED };
	if (!started.ok) return { ok: false, message: serveFailureMessage(started.output) };
	const state = await serveState(port);
	return {
		ok: true,
		state: {
			...state,
			installed: true,
			running: true,
			serving: true,
			url: serveUrl(started.output) ?? state.url,
			error: null,
		},
	};
}

export async function reconcileServe(port: number, answers = portAnswers): Promise<ServeState> {
	const state = await serveState(port);
	if (!state.installed || state.serving || !servePointsElsewhere(state, port)) return state;
	if (state.port !== null && (await answers(state.port))) return state;
	const started = await startTailscaleServe(port);
	if (!started.found || !started.ok) return state;
	return serveState(port);
}
