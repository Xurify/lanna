"use client";
/**
 * Settings → Reset: start over on this language. The server moves the
 * profile's data folder into data/backups/ (nothing is deleted), then the
 * page reloads into onboarding.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const CONFIRM_WORD = "RESET";

export function ResetSection({ language }: { language?: string }) {
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [backup, setBackup] = useState<string | null>(null);
	const [where, setWhere] = useState<{ data: string; backups: string; backupCount: number } | null>(null);

	useEffect(() => {
		void fetch("/api/reset", { cache: "no-store" })
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => setWhere(d as typeof where))
			.catch(() => undefined);
	}, []);

	const run = async () => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: CONFIRM_WORD }) });
			const body = (await res.json()) as { error?: string; backup?: string };
			if (!res.ok) throw new Error(body.error ?? `Reset failed (${res.status})`);
			setBackup(body.backup ?? null);
			setTimeout(() => window.location.assign("/"), 1500);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Reset failed");
			setBusy(false);
		}
	};

	if (backup !== null) {
		return (
			<p className="text-sm text-foreground" role="status" data-testid="reset-done">
				Done. Your old data is kept at <code className="font-mono text-xs">{backup}</code>. Reloading…
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-3" data-testid="reset-section">
			<p className="text-sm text-muted-foreground">
				Start over{language ? ` in ${language}` : ""}: progress, level, goal, chats, review cards, skill map, speaking sessions and stories all go. Your provider keys, settings and voice clips stay.
				Nothing is deleted: the data is moved into a backup folder you can put back.
			</p>
			{where && (
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" data-testid="reset-locations">
					<dt className="text-muted-foreground">Your data</dt>
					<dd className="min-w-0 break-all font-mono text-foreground">{where.data}</dd>
					<dt className="text-muted-foreground">Old data</dt>
					<dd className="min-w-0 break-all font-mono text-foreground">
						{where.backups}
						<span className="font-sans text-muted-foreground">{where.backupCount === 0 ? " (none yet)" : ` (${where.backupCount} saved)`}</span>
					</dd>
				</dl>
			)}
			{!open ? (
				<div>
					<Button type="button" variant="destructive-soft" data-testid="reset-open" onClick={() => setOpen(true)}>
						Reset my data…
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2 rounded-lg bg-destructive/10 p-4">
					<label className="text-sm text-foreground" htmlFor="reset-confirm">
						Type <strong>{CONFIRM_WORD}</strong> to confirm
					</label>
					<input
						id="reset-confirm"
						data-testid="reset-input"
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						disabled={busy}
						autoComplete="off"
						spellCheck={false}
						className="h-9 w-48 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					/>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<div className="flex gap-2">
						<Button type="button" variant="destructive" size="sm" data-testid="reset-confirm" disabled={busy || typed !== CONFIRM_WORD} onClick={() => void run()}>
							{busy ? "Resetting…" : "Reset everything"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={busy}
							onClick={() => {
								setOpen(false);
								setTyped("");
								setError(null);
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
