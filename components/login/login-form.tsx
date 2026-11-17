"use client";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LannaAppIcon } from "@/components/lanna-mark";

function waitText(seconds: number): string {
	const minutes = Math.max(1, Math.ceil(seconds / 60));
	return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

export function LoginForm({ next }: { next: string }) {
	const [password, setPassword] = useState("");
	const [revealed, setRevealed] = useState(false);
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
			const body = (await res.json().catch(() => null)) as {
				error?: string;
				next?: string;
				retryAfterSec?: number;
			} | null;
			if (res.ok) {
				// A full load, so the new cookie is in place for every request that follows.
				window.location.assign(body?.next ?? "/");
				return;
			}
			setPassword("");
			setError(
				res.status === 429 && body?.retryAfterSec
					? `Too many tries. Try again in ${waitText(body.retryAfterSec)}.`
					: (body?.error ?? "Could not sign in. Try again."),
			);
		} catch {
			setError("Lanna could not be reached. Check your connection, then try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="flex min-h-dvh w-full items-center justify-center px-6 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
			<div className="-mt-[6vh] w-full max-w-[320px]">
				<LannaAppIcon className="mx-auto size-14" />
				<h1
					className="mt-5 text-center font-ui text-[22px] font-semibold tracking-tight text-foreground"
					data-testid="login-heading"
				>
					Welcome to Lanna
				</h1>
				<p className="mt-1.5 text-center text-[15px] leading-snug text-[var(--q-ink-2)]">
					Enter your password to continue.
				</p>
				<form onSubmit={signIn} className="mt-8 flex flex-col gap-3" data-testid="login-form">
					<label htmlFor="login-password" className="sr-only">
						Password
					</label>
					<div className="relative">
						<input
							id="login-password"
							type={revealed ? "text" : "password"}
							name="password"
							placeholder="Password"
							autoComplete="current-password"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck={false}
							autoFocus
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							maxLength={200}
							aria-describedby="login-error"
							// Safari zooms into any text field under 16 px, and the app's text-base is 14 px.
							className="q-field h-11 w-full pr-11 pl-3.5 font-ui text-[16px] placeholder:text-[var(--q-ink-3)] md:text-[16px]"
							data-testid="login-password"
						/>
						<button
							type="button"
							onClick={() => setRevealed((value) => !value)}
							aria-pressed={revealed}
							aria-label={revealed ? "Hide password" : "Show password"}
							className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-[var(--radius-md)] text-[var(--q-ink-3)] hover:text-[var(--q-ink-2)] focus-visible:text-[var(--q-ink-2)] focus-visible:outline-none"
							data-testid="login-reveal"
						>
							{revealed ? (
								<EyeOffIcon className="size-[18px]" aria-hidden="true" />
							) : (
								<EyeIcon className="size-[18px]" aria-hidden="true" />
							)}
						</button>
					</div>
					<button
						type="submit"
						className="q-btn primary wide cursor-pointer"
						disabled={busy || password.length === 0}
						aria-busy={busy}
						data-testid="login-submit"
					>
						{busy ? "Signing in…" : "Sign in"}
					</button>
					<p
						id="login-error"
						role="alert"
						className="min-h-10 text-center text-[13.5px] leading-snug text-[var(--q-miss)]"
						data-testid="login-error"
					>
						{error ?? ""}
					</p>
				</form>
				<p className="text-center text-[13px] leading-snug text-[var(--q-ink-3)]">
					This browser stays signed in for 180 days.
				</p>
			</div>
		</main>
	);
}
