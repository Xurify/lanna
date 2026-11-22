"use client";
/**
 * Settings → Devices (E21): the remote-access switch, the pairing code, and the
 * devices that may open Lanna. Off by default. While the switch is off,
 * nothing on this screen changes what the computer does. Turning it off signs
 * every device out, so the confirmation names that first.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommitInput, SettingsDisclosure, SettingsGroup, SettingsRow, Toggle } from "./controls.tsx";

type Device = {
	id: string;
	name: string;
	createdAt: string;
	lastSeenAt: string;
	current: boolean;
	via: "pairing" | "password";
};
type Status = {
	enabled: boolean;
	port: number;
	serveCommand: string;
	devices: Device[];
	pairing: { expiresAt: string } | null;
};
type Code = { code: string; expiresAt: string };
type ServeStatus = {
	installed: boolean;
	running?: boolean;
	canOpen?: boolean;
	serving: boolean;
	url: string | null;
	port: number | null;
	error?: string | null;
};
type Notice = { tone: "ok" | "error"; text: string };

const LOAD_FAILED = "Couldn’t read the remote access settings. Refresh to try again.";
const COPY_FAILED = "Couldn’t copy. Select the command and copy it by hand.";
const SERVE_FAILED = "Couldn’t start Tailscale Serve. Try again, or run the command below in a terminal.";
const PORT_FAILED = "Couldn’t save the port. Try again.";

function when(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function clock(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function readStatus(response: Response): Promise<Status> {
	if (!response.ok) throw new Error(`access ${response.status}`);
	return (await response.json()) as Status;
}

const PAIRING_POLL_MS = 2000;

function fetchStatus(): Promise<Status> {
	return fetch("/api/access", { cache: "no-store" }).then(readStatus);
}

export function DevicesSection() {
	const [status, setStatus] = useState<Status | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [serveStatus, setServeStatus] = useState<ServeStatus | null>(null);
	const [serveStarting, setServeStarting] = useState(false);
	const [openingTailscale, setOpeningTailscale] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [code, setCode] = useState<Code | null>(null);
	const [now, setNow] = useState(() => Date.now());
	/** "off" while the turn-off confirmation is open, a device id while its sign-out is. */
	const [confirming, setConfirming] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	/** The saved preferred port as text ("" = factory 31551); null until read. */
	const [port, setPort] = useState<string | null>(null);

	// Read on open, and again whenever the window regains focus: a phone may have
	// paired (or been signed out) while this screen was in the background.
	useEffect(() => {
		const refresh = () =>
			fetchStatus()
				.then(setStatus)
				.catch(() => setLoadFailed(true));
		void refresh();
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	useEffect(() => {
		if (!status?.enabled) {
			setServeStatus(null);
			return;
		}
		let live = true;
		const refreshServe = () => {
			fetch("/api/access/serve", { cache: "no-store" })
				.then((response) => (response.ok ? (response.json() as Promise<ServeStatus>) : null))
				.then((next) => {
					if (live && next) setServeStatus(next);
				})
				.catch(() => {});
		};
		refreshServe();
		window.addEventListener("focus", refreshServe);
		return () => {
			live = false;
			window.removeEventListener("focus", refreshServe);
		};
	}, [status?.enabled]);

	// The port lives in settings.json, which the desktop shell reads before it
	// starts the server — so this screen shows the saved value, not the running one.
	useEffect(() => {
		let live = true;
		fetch("/api/settings", { cache: "no-store" })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { settings?: { devices?: { preferredPort?: number } } | null } | null) => {
				if (!live) return;
				const saved = body?.settings?.devices?.preferredPort;
				setPort(typeof saved === "number" ? String(saved) : "");
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	}, []);

	const knownDevices = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (status) knownDevices.current = new Set(status.devices.map((device) => device.id));
	}, [status]);

	// The phone pairs on its own screen, so this window has to ask. The server retires
	// the code the moment it is used, which is what ends the poll.
	useEffect(() => {
		if (!code) return;
		const timer = window.setInterval(() => {
			fetchStatus()
				.then((next) => {
					const joined = next.devices.find((device) => !knownDevices.current.has(device.id));
					setStatus(next);
					if (next.pairing) return;
					setCode(null);
					if (joined) setNotice({ tone: "ok", text: `${joined.name} is paired.` });
				})
				.catch(() => {});
		}, PAIRING_POLL_MS);
		return () => window.clearInterval(timer);
	}, [code]);

	// The countdown ticks only while a code is on screen.
	useEffect(() => {
		if (!code) return;
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [code]);

	async function setEnabled(next: boolean) {
		setBusy(true);
		setNotice(null);
		try {
			const response = await fetch("/api/access", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: next }),
				cache: "no-store",
			});
			setStatus(await readStatus(response));
			setConfirming(null);
			if (!next) setCode(null);
			setNotice({
				tone: "ok",
				text: next
					? "Remote access is on. Set up Tailscale Serve below, then pair a device."
					: "Remote access is off. Every device has been signed out.",
			});
		} catch {
			setNotice({ tone: "error", text: "Couldn’t change remote access. Try again." });
		} finally {
			setBusy(false);
		}
	}

	async function makeCode() {
		setBusy(true);
		setNotice(null);
		try {
			const response = await fetch("/api/access/pairing", { method: "POST", cache: "no-store" });
			const body = (await response.json().catch(() => null)) as (Partial<Code> & { error?: string }) | null;
			if (!response.ok || !body?.code || !body.expiresAt) {
				setNotice({ tone: "error", text: body?.error ?? "Couldn’t make a code. Try again." });
				return;
			}
			setCode({ code: body.code, expiresAt: body.expiresAt });
			setNow(Date.now());
			setStatus(await fetchStatus());
		} catch {
			setNotice({ tone: "error", text: "Couldn’t make a code. Try again." });
		} finally {
			setBusy(false);
		}
	}

	async function signOut(id: string) {
		setBusy(true);
		setNotice(null);
		try {
			const response = await fetch(`/api/access/devices/${encodeURIComponent(id)}`, {
				method: "DELETE",
				cache: "no-store",
			});
			const next = await readStatus(response);
			if (status?.devices.some((device) => device.id === id && device.current && device.via === "password")) {
				window.location.assign("/login");
				return;
			}
			setStatus(next);
			setConfirming(null);
			setNotice({ tone: "ok", text: "That device is signed out." });
		} catch {
			setNotice({ tone: "error", text: "Couldn’t sign that device out. Try again." });
		} finally {
			setBusy(false);
		}
	}

	async function setUpServe() {
		setServeStarting(true);
		setNotice(null);
		try {
			const response = await fetch("/api/access/serve", { method: "POST", cache: "no-store" });
			const next = (await response.json().catch(() => null)) as (ServeStatus & { error?: string }) | null;
			if (!response.ok || !next || typeof next.serving !== "boolean") {
				const errorMessage = next?.error ?? SERVE_FAILED;
				setServeStatus((previous) => ({
					installed: previous?.installed ?? true,
					running: errorMessage.includes("not running") ? false : (previous?.running ?? true),
					serving: false,
					url: null,
					port: null,
					error: errorMessage,
				}));
				setNotice({ tone: "error", text: errorMessage });
				return;
			}
			setServeStatus(next);
			setNotice({
				tone: "ok",
				text: next.url ? `Tailscale Serve is on. Open ${next.url} on the phone.` : "Tailscale Serve is on.",
			});
		} catch {
			setServeStatus((previous) => ({
				installed: previous?.installed ?? true,
				running: previous?.running ?? false,
				serving: false,
				url: null,
				port: null,
				error: SERVE_FAILED,
			}));
			setNotice({ tone: "error", text: SERVE_FAILED });
		} finally {
			setServeStarting(false);
		}
	}

	async function openTailscaleApp() {
		setOpeningTailscale(true);
		setNotice(null);
		try {
			const response = await fetch("/api/access/serve/open", { method: "POST", cache: "no-store" });
			const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
			if (!response.ok || !body?.ok) {
				setNotice({ tone: "error", text: body?.error ?? "Couldn’t open Tailscale. Open it from your applications." });
				return;
			}
			setNotice({ tone: "ok", text: "Opened Tailscale. When it connects, this screen updates." });
		} catch {
			setNotice({ tone: "error", text: "Couldn’t open Tailscale. Open it from your applications." });
		} finally {
			setOpeningTailscale(false);
		}
	}

	async function savePort(next: string) {
		setNotice(null);
		const trimmed = next.trim();
		try {
			const response = await fetch("/api/settings/devices", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ preferredPort: trimmed === "" ? null : Number(trimmed) }),
				cache: "no-store",
			});
			const body = (await response.json().catch(() => null)) as {
				settings?: { devices?: { preferredPort?: number } };
				error?: string;
			} | null;
			if (!response.ok) {
				setNotice({ tone: "error", text: body?.error ?? PORT_FAILED });
				return;
			}
			const saved = body?.settings?.devices?.preferredPort;
			setPort(typeof saved === "number" ? String(saved) : "");
			setNotice({
				tone: "ok",
				text:
					typeof saved === "number"
						? `Saved. Lanna will try port ${saved} the next time it starts.`
						: "Saved. Lanna tries 31551 first again.",
			});
		} catch {
			setNotice({ tone: "error", text: PORT_FAILED });
		}
	}

	async function copyCommand(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setNotice({ tone: "error", text: COPY_FAILED });
		}
	}

	if (!status) {
		return (
			<p
				role={loadFailed ? "alert" : "status"}
				className="min-h-24 text-xs text-muted-foreground"
				data-testid="devices-loading"
			>
				{loadFailed ? LOAD_FAILED : "Checking remote access…"}
			</p>
		);
	}

	const isServeError = Boolean(serveStatus?.error || (serveStatus?.installed && serveStatus?.running === false));
	const serveLine = !serveStatus ? (
		"Checking whether Serve is on…"
	) : !serveStatus.installed ? (
		<>
			Tailscale is not installed on this computer.{" "}
			<a
				href="https://tailscale.com/download"
				target="_blank"
				rel="noopener noreferrer"
				className="underline underline-offset-2 hover:text-foreground"
				data-testid="devices-serve-download"
			>
				Install Tailscale
			</a>
			, sign in, then try again.
		</>
	) : serveStatus.error ? (
		serveStatus.error
	) : !serveStatus.running ? (
		"Tailscale is not running on this computer. Start Tailscale, then try again."
	) : serveStatus.serving ? (
		"On. This address answers on your tailnet."
	) : serveStatus.port !== null ? (
		`Off. Serve is set up for port ${serveStatus.port}; Lanna points it here on its next start.`
	) : (
		"Off. Lanna can start it for you."
	);

	const left = code ? Date.parse(code.expiresAt) - now : 0;
	const codeLine =
		code && left > 0
			? `Enter it on the device within ${clock(left)}. Open Lanna there and type the code.`
			: code
				? "That code has expired. Make a new one."
				: status.pairing
					? "A code is waiting. Make a new one to see it."
					: "No code is waiting.";

	return (
		<>
			<SettingsGroup label="Remote access" testid="devices-switch">
				<SettingsRow
					label={status.enabled ? "On: other devices can pair" : "Off: only this computer can open Lanna"}
					hint="Phones and tablets on your Tailscale network sign in with a code from this screen. While this is off, nothing outside this computer can reach the app."
					testid="devices-row-switch"
				>
					<Toggle
						checked={status.enabled}
						disabled={busy}
						label="Remote access"
						testid="devices-toggle"
						onChange={(next) => (next ? void setEnabled(true) : setConfirming("off"))}
					/>
				</SettingsRow>
				{confirming === "off" && (
					<div
						className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 px-4 py-3"
						data-testid="devices-confirm-off"
					>
						<span className="text-xs text-muted-foreground">
							Turning this off signs out every device, including phones and tablets.
						</span>
						<span className="flex gap-2">
							<Button
								type="button"
								size="xs"
								variant="destructive-soft"
								className="cursor-pointer"
								disabled={busy}
								onClick={() => void setEnabled(false)}
								data-testid="devices-turn-off"
							>
								Turn off
							</Button>
							<Button
								type="button"
								size="xs"
								variant="outline"
								className="cursor-pointer"
								onClick={() => setConfirming(null)}
							>
								Keep on
							</Button>
						</span>
					</div>
				)}
			</SettingsGroup>

			<SettingsDisclosure
				label="Advanced"
				hint="Only change the port if you know what you are doing. Serve, bookmarks and the desktop shell all have to agree on it."
				testid="devices-advanced"
			>
				<SettingsGroup
					label="Port"
					hint="Lanna tries this port whenever it starts, so a Tailscale Serve address keeps working across restarts. Empty means 31551."
					testid="devices-port"
				>
					<SettingsRow
						label="Preferred port"
						hint={`This window runs on ${status.port}. A change applies the next time Lanna starts.`}
						testid="devices-port-row"
					>
						{port !== null && (
							<CommitInput
								value={port}
								placeholder="31551"
								type="number"
								ariaLabel="Preferred port"
								testid="devices-port-input"
								onCommit={(next) => void savePort(next)}
							/>
						)}
					</SettingsRow>
				</SettingsGroup>
			</SettingsDisclosure>

			{status.enabled && (
				<>
					<SettingsGroup
						label="Tailscale Serve"
						hint={`Publishes Lanna over HTTPS on your tailnet only, for port ${status.port}, the port this window uses. Tailscale must be signed in on this computer, with HTTPS certificates turned on.`}
						testid="devices-serve"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span
								className={`min-w-0 flex-1 text-xs leading-relaxed ${isServeError ? "text-destructive" : "text-muted-foreground"}`}
								role={isServeError ? "alert" : undefined}
								data-testid="devices-serve-state"
							>
								{serveLine}
							</span>
							<span className="flex items-center gap-2">
								{serveStatus?.running === false && serveStatus.canOpen && (
									<Button
										type="button"
										size="sm"
										className="min-w-28 cursor-pointer"
										disabled={openingTailscale}
										onClick={() => void openTailscaleApp()}
										data-testid="devices-serve-open"
									>
										{openingTailscale ? "Opening…" : "Open Tailscale"}
									</Button>
								)}
								<Button
									type="button"
									size="sm"
									variant={serveStatus?.running === false && serveStatus.canOpen ? "outline" : "default"}
									className="min-w-28 cursor-pointer"
									disabled={serveStarting || serveStatus?.installed === false}
									onClick={() => void setUpServe()}
									data-testid="devices-serve-start"
								>
									{serveStarting
										? "Starting…"
										: isServeError
											? "Try again"
											: serveStatus?.serving
												? "Set up again"
												: "Set up now"}
								</Button>
							</span>
						</div>
						{serveStatus?.serving && serveStatus.url && (
							<p className="text-xs text-muted-foreground" data-testid="devices-serve-url">
								Open <code className="font-mono break-all">{serveStatus.url}</code> on the phone or tablet, then pair it
								below.
							</p>
						)}
						<div className="flex flex-wrap items-center gap-2">
							<code
								className="min-w-0 flex-1 break-all rounded-lg border border-border/50 bg-accent/15 px-3 py-2 font-mono text-xs text-foreground"
								data-testid="devices-serve-command"
							>
								{status.serveCommand}
							</code>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="min-w-20 cursor-pointer"
								onClick={() => void copyCommand(status.serveCommand)}
								data-testid="devices-copy"
							>
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Or run that command in a terminal on this computer. Check it with{" "}
							<code className="font-mono">tailscale serve status</code>. The full steps are in docs/remote-access.md.
						</p>
					</SettingsGroup>

					<SettingsGroup label="Pair a device" testid="devices-pair">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{codeLine}</span>
							<Button
								type="button"
								size="sm"
								className="min-w-28 cursor-pointer"
								disabled={busy}
								onClick={() => void makeCode()}
								data-testid="devices-make-code"
							>
								{code || status.pairing ? "New code" : "Make a code"}
							</Button>
						</div>
						{/* Holds its height with or without a code, so the list below never moves. */}
						<div className="flex min-h-14 items-center" aria-live="polite">
							{code && left > 0 && (
								<span
									className="font-mono text-3xl font-semibold tracking-[0.2em] text-foreground tabular-nums"
									data-testid="devices-code"
								>
									{code.code}
								</span>
							)}
						</div>
					</SettingsGroup>

					<SettingsGroup
						label="Devices"
						hint="Each device stays signed in for 180 days, unless you sign it out here."
						testid="devices-list"
					>
						{status.devices.length === 0 && <p className="text-xs text-muted-foreground">No devices are paired yet.</p>}
						{status.devices.map((device) => (
							<SettingsRow
								key={device.id}
								label={device.current ? `${device.name} · this device` : device.name}
								hint={`${device.via === "password" ? "Signed in" : "Paired"} ${when(device.createdAt)} · last used ${when(device.lastSeenAt)}`}
								testid={`devices-row-${device.id}`}
							>
								{confirming === device.id ? (
									<span className="flex gap-2">
										<Button
											type="button"
											size="xs"
											variant="destructive-soft"
											className="cursor-pointer"
											disabled={busy}
											onClick={() => void signOut(device.id)}
											data-testid={`devices-confirm-${device.id}`}
										>
											Sign out
										</Button>
										<Button
											type="button"
											size="xs"
											variant="outline"
											className="cursor-pointer"
											onClick={() => setConfirming(null)}
										>
											Keep
										</Button>
									</span>
								) : (
									<Button
										type="button"
										size="xs"
										variant="outline"
										className="cursor-pointer"
										disabled={busy}
										onClick={() => setConfirming(device.id)}
										data-testid={`devices-revoke-${device.id}`}
									>
										Sign out
									</Button>
								)}
							</SettingsRow>
						))}
					</SettingsGroup>
				</>
			)}
			{/* At the end, where its reserved line is not a gap under the title. */}
			<p
				role={notice?.tone === "error" ? "alert" : "status"}
				className={`min-h-5 text-xs ${notice?.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
				data-testid="devices-notice"
			>
				{notice?.text ?? ""}
			</p>
		</>
	);
}
