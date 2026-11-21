import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT_MS = 30_000;

const NOT_INSTALLED =
	"Tailscale is not installed on this computer. Install it from tailscale.com/download, sign it in, then try again.";
const NOT_ENABLED =
	"Tailscale Serve is not enabled for your tailnet. Run the command below in a terminal once, open the link it prints, then try again.";
const NOT_SIGNED_IN = "Tailscale is not signed in on this computer. Sign in to Tailscale, then try again.";
const OLD_VERSION =
	"This Tailscale version does not take --bg. Update Tailscale, or run `tailscale serve --help` and use the form it lists.";
const UNKNOWN_FLAG = /unknown flag|flag provided but not defined|unrecognized flag|invalid flag/i;

export type ServeState = { installed: boolean; serving: boolean; url: string | null };
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
	for (const bin of installedBinaries()) {
		try {
			const { stdout, stderr } = await execFileAsync(bin, args, { timeout: CLI_TIMEOUT_MS, windowsHide: true });
			return { found: true, ok: true, output: `${stdout}${stderr}`.trim() };
		} catch (err) {
			const failure = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
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

export function servesPort(text: string, port: number): boolean {
	return new RegExp(`(?:127\\.0\\.0\\.1|localhost|\\[::1\\]|0\\.0\\.0\\.0):${port}(?!\\d)`).test(text);
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
	if (/not logged in|logged out|needs login|login required|no node key/i.test(text)) return NOT_SIGNED_IN;
	return text.slice(0, 400) || "Tailscale did not start Serve.";
}

export async function serveState(port: number): Promise<ServeState> {
	const status = await runTailscale(["serve", "status"]);
	if (!status.found) return { installed: false, serving: false, url: null };
	if (!status.ok) return { installed: true, serving: false, url: null };
	const url = serveUrl(status.output);
	const serving = url !== null && servesPort(status.output, port);
	return { installed: true, serving, url: serving ? url : null };
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
	return { ok: true, state: { ...state, installed: true, serving: true, url: serveUrl(started.output) ?? state.url } };
}
