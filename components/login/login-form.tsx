"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function waitText(seconds: number): string {
	const minutes = Math.max(1, Math.ceil(seconds / 60));
	return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

export function LoginForm({ next }: { next: string }) {
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function signIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy || password.length === 0) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/access/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password, next }),
				cache: "no-store",
			});
			const body = (await res.json().catch(() => null)) as { error?: string; next?: string; retryAfterSec?: number } | null;
			if (res.ok) {
				// A full load, so the new cookie is in place for every request that follows.
				window.location.assign(body?.next ?? "/");
				return;
			}
			setPassword("");
			setError(res.status === 429 && body?.retryAfterSec ? `Too many tries. Try again in ${waitText(body.retryAfterSec)}.` : (body?.error ?? "Could not sign in. Try again."));
		} catch {
			setError("LangHarness could not be reached. Check your connection, then try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="flex min-h-dvh w-full items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
			<div className="w-full max-w-sm">
				<h1 className="font-ui text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">Enter the password for this LangHarness. This browser stays signed in for 180 days.</p>
				<form onSubmit={signIn} className="relative mt-6 flex flex-col gap-4" data-testid="login-form">
					<label className="flex flex-col gap-1.5">
						<span className="font-ui text-xs font-semibold text-foreground">Password</span>
						<Input
							type="password"
							name="password"
							autoComplete="current-password"
							autoFocus
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							maxLength={200}
							// Safari zooms into any text field under 16 px, and the app's text-base is 14 px.
							className="h-11 text-[16px] md:text-[16px] focus-visible:ring-1"
							data-testid="login-password"
						/>
					</label>
					<Button type="submit" className="h-11 cursor-pointer" disabled={busy || password.length === 0} aria-busy={busy} data-testid="login-submit">
						{busy ? "Signing in…" : "Sign in"}
					</Button>
					<p role="alert" className="absolute inset-x-0 top-full mt-3 text-sm leading-relaxed text-destructive" data-testid="login-error">
						{error ?? ""}
					</p>
				</form>
			</div>
		</main>
	);
}
