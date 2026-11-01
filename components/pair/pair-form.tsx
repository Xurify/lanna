"use client";
/**
 * The pairing screen (E21): a phone or iPad types the six-digit code shown on
 * the computer. The error line keeps its height, so a message never moves the
 * form. The inputs are 16 px or larger, so iOS does not zoom when they focus.
 */

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PairForm({ next }: { next: string }) {
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const digits = code.replace(/\D/g, "");

	async function pair(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy || digits.length !== 6) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/access/pair", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: digits, name }),
				cache: "no-store",
			});
			if (res.ok) {
				// A full load, so the new cookie is in place for every request that follows.
				window.location.assign(next);
				return;
			}
			const body = (await res.json().catch(() => null)) as { error?: string } | null;
			setError(body?.error ?? "This device could not be paired. Try again.");
		} catch {
			setError("LangHarness could not be reached. Check that Tailscale is on, then try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="flex min-h-dvh items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
			<div className="w-full max-w-sm">
				<h1 className="font-ui text-2xl font-bold tracking-tight text-foreground">Pair this device</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					On the computer, open Settings, then Devices, and choose Make a code. The code works for five minutes, and only once.
				</p>
				<form onSubmit={pair} className="mt-6 flex flex-col gap-4" data-testid="pair-form">
					<label className="flex flex-col gap-1.5">
						<span className="font-ui text-xs font-semibold text-foreground">Code from the computer</span>
						<Input
							inputMode="numeric"
							autoComplete="one-time-code"
							autoFocus
							value={code}
							onChange={(event) => setCode(event.target.value)}
							placeholder="000 000"
							maxLength={9}
							className="h-11 font-mono text-lg tracking-widest tabular-nums"
							data-testid="pair-code"
						/>
					</label>
					<label className="flex flex-col gap-1.5">
						<span className="font-ui text-xs font-semibold text-foreground">Name this device</span>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="iPhone"
							maxLength={40}
							className="h-11 text-base"
							data-testid="pair-name"
						/>
					</label>
					<Button type="submit" className="h-11 cursor-pointer" disabled={busy || digits.length !== 6} aria-busy={busy} data-testid="pair-submit">
						{busy ? "Pairing…" : "Pair this device"}
					</Button>
					<p role="alert" className="min-h-10 text-sm leading-relaxed text-destructive" data-testid="pair-error">
						{error ?? ""}
					</p>
				</form>
			</div>
		</main>
	);
}
