"use client";
/**
 * Settings → Phone & tablet (E21): the remote-access switch, the pairing code, and the
 * devices that may open LangHarness. Off by default. While the switch is off,
 * nothing on this screen changes what the computer does. Turning it off signs
 * every device out, so the confirmation names that first.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsGroup, SettingsRow, Toggle } from "./controls.tsx";

type Device = { id: string; name: string; createdAt: string; lastSeenAt: string; current: boolean };
type Status = {
	enabled: boolean;
	port: number;
	serveCommand: string;
	devices: Device[];
	pairing: { expiresAt: string } | null;
};
type Code = { code: string; expiresAt: string };
type Notice = { tone: "ok" | "error"; text: string };

const LOAD_FAILED = "Couldn’t read the remote access settings. Refresh to try again.";
const COPY_FAILED = "Couldn’t copy. Select the command and copy it by hand.";

function when(iso: string): string {
	return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function clock(ms: number): string {
	const total = Math.max(0, Math.ceil(ms / 1000));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

async function readStatus(res: Response): Promise<Status> {
	if (!res.ok) throw new Error(`access ${res.status}`);
	return (await res.json()) as Status;
}

export function DevicesSection() {
	const [status, setStatus] = useState<Status | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [code, setCode] = useState<Code | null>(null);
	const [now, setNow] = useState(() => Date.now());
	/** "off" while the turn-off confirmation is open, a device id while its sign-out is. */
	const [confirming, setConfirming] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// Read on open, and again whenever the window regains focus: a phone may have
	// paired (or been signed out) while this screen was in the background.
	useEffect(() => {
		const refresh = () =>
			fetch("/api/access", { cache: "no-store" })
				.then(readStatus)
				.then(setStatus)
				.catch(() => setLoadFailed(true));
		void refresh();
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

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
			const res = await fetch("/api/access", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: next }),
				cache: "no-store",
			});
			setStatus(await readStatus(res));
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
			const res = await fetch("/api/access/pairing", { method: "POST", cache: "no-store" });
			const body = (await res.json().catch(() => null)) as (Partial<Code> & { error?: string }) | null;
			if (!res.ok || !body?.code || !body.expiresAt) {
				setNotice({ tone: "error", text: body?.error ?? "Couldn’t make a code. Try again." });
				return;
			}
			setCode({ code: body.code, expiresAt: body.expiresAt });
			setNow(Date.now());
			setStatus(await fetch("/api/access", { cache: "no-store" }).then(readStatus));
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
			const res = await fetch(`/api/access/devices/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
			setStatus(await readStatus(res));
			setConfirming(null);
			setNotice({ tone: "ok", text: "That device is signed out." });
		} catch {
			setNotice({ tone: "error", text: "Couldn’t sign that device out. Try again." });
		} finally {
			setBusy(false);
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
			<p role={loadFailed ? "alert" : "status"} className="min-h-24 text-xs text-muted-foreground" data-testid="devices-loading">
				{loadFailed ? LOAD_FAILED : "Checking remote access…"}
			</p>
		);
	}

	const left = code ? Date.parse(code.expiresAt) - now : 0;
	const codeLine = code && left > 0
		? `Enter it on the device within ${clock(left)}. Open LangHarness there and type the code.`
		: code
			? "That code has expired. Make a new one."
			: status.pairing
				? "A code is waiting. Make a new one to see it."
				: "No code is waiting.";

	return (
		<>
			<p role={notice?.tone === "error" ? "alert" : "status"} className="min-h-5 text-xs text-muted-foreground" data-testid="devices-notice">
				{notice?.text ?? ""}
			</p>
			<SettingsGroup label="Remote access" testid="devices-switch">
				<SettingsRow
					label={status.enabled ? "On: other devices can pair" : "Off: only this computer can open LangHarness"}
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
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 px-4 py-3" data-testid="devices-confirm-off">
						<span className="text-xs text-muted-foreground">Turning this off signs out every device, including phones and tablets.</span>
						<span className="flex gap-2">
							<Button type="button" size="xs" variant="destructive-soft" className="cursor-pointer" disabled={busy} onClick={() => void setEnabled(false)} data-testid="devices-turn-off">
								Turn off
							</Button>
							<Button type="button" size="xs" variant="outline" className="cursor-pointer" onClick={() => setConfirming(null)}>
								Keep on
							</Button>
						</span>
					</div>
				)}
			</SettingsGroup>

			{status.enabled && (
				<>
					<SettingsGroup
						label="Set up Tailscale Serve"
						hint="Run this once in a terminal on this computer, with Tailscale signed in and HTTPS certificates turned on. It serves LangHarness over HTTPS on your tailnet only."
						testid="devices-serve"
					>
						<div className="flex flex-wrap items-center gap-2">
							<code className="min-w-0 flex-1 break-all rounded-lg border border-border/50 bg-accent/15 px-3 py-2 font-mono text-xs text-foreground" data-testid="devices-serve-command">
								{status.serveCommand}
							</code>
							<Button type="button" size="sm" variant="outline" className="min-w-20 cursor-pointer" onClick={() => void copyCommand(status.serveCommand)} data-testid="devices-copy">
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							It serves port {status.port}, the port this window uses. Check it with <code className="font-mono">tailscale serve status</code>. The full steps are in docs/remote-access.md.
						</p>
					</SettingsGroup>

					<SettingsGroup label="Pair a device" testid="devices-pair">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{codeLine}</span>
							<Button type="button" size="sm" className="min-w-28 cursor-pointer" disabled={busy} onClick={() => void makeCode()} data-testid="devices-make-code">
								{code || status.pairing ? "New code" : "Make a code"}
							</Button>
						</div>
						{/* Holds its height with or without a code, so the list below never moves. */}
						<div className="flex min-h-14 items-center" aria-live="polite">
							{code && left > 0 && (
								<span className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground tabular-nums" data-testid="devices-code">
									{code.code}
								</span>
							)}
						</div>
					</SettingsGroup>

					<SettingsGroup label="Devices" hint="Each device stays signed in for 180 days, unless you sign it out here." testid="devices-list">
						{status.devices.length === 0 && <p className="text-xs text-muted-foreground">No devices are paired yet.</p>}
						{status.devices.map((device) => (
							<SettingsRow
								key={device.id}
								label={device.current ? `${device.name} · this device` : device.name}
								hint={`Paired ${when(device.createdAt)} · last used ${when(device.lastSeenAt)}`}
								testid={`devices-row-${device.id}`}
							>
								{confirming === device.id ? (
									<span className="flex gap-2">
										<Button type="button" size="xs" variant="destructive-soft" className="cursor-pointer" disabled={busy} onClick={() => void signOut(device.id)} data-testid={`devices-confirm-${device.id}`}>
											Sign out
										</Button>
										<Button type="button" size="xs" variant="outline" className="cursor-pointer" onClick={() => setConfirming(null)}>
											Keep
										</Button>
									</span>
								) : (
									<Button type="button" size="xs" variant="outline" className="cursor-pointer" disabled={busy} onClick={() => setConfirming(device.id)} data-testid={`devices-revoke-${device.id}`}>
										Sign out
									</Button>
								)}
							</SettingsRow>
						))}
					</SettingsGroup>
				</>
			)}
		</>
	);
}
