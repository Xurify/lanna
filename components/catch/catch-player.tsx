"use client";

/**
 * Catch the mistake (app/catch): two or three sentences with one wrong word. The learner taps the wrong
 * word, types the word that belongs there, and then sees the whole item. The card keeps its height while
 * an item loads, so nothing below it moves.
 */

import { useState } from "react";
import { SourcesNote } from "@/components/sources/sources-note";
import type { CatchNext, CatchResult, CatchToken } from "@/src/core";

type Tap = { sentence: number; token: number };

const BUTTON = "min-h-11 rounded-lg px-4 font-ui text-sm font-[600] transition-colors disabled:opacity-50";

export function CatchPlayer() {
	const [next, setNext] = useState<CatchNext | null>(null);
	const [result, setResult] = useState<CatchResult | null>(null);
	const [tap, setTap] = useState<Tap | null>(null);
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [started, setStarted] = useState(false);

	async function load() {
		setStarted(true);
		setBusy(true);
		setError(null);
		setResult(null);
		setTap(null);
		setTyped("");
		try {
			const res = await fetch("/api/catch", { cache: "no-store" });
			const body = (await res.json()) as CatchNext & { message?: string };
			if (!res.ok) {
				setError(body.message ?? "The item could not be made.");
				setNext({ view: null });
			} else {
				setNext(body);
			}
		} catch {
			setError("The item could not be made. Check the connection and try again.");
			setNext({ view: null });
		} finally {
			setBusy(false);
		}
	}

	async function check() {
		if (!next?.view || !tap) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/catch", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: next.view.id, sentence: tap.sentence, token: tap.token, typed }),
			});
			const body = (await res.json()) as CatchResult & { message?: string };
			if (!res.ok) setError(body.message ?? "The answer was not kept.");
			else setResult(body);
		} catch {
			setError("The answer was not kept. Check the connection and try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-8">
			<h1 className="font-ui text-2xl font-[600] text-foreground">Catch the mistake</h1>
			<p className="mt-2 font-ui text-sm text-muted-foreground">One word in this text is wrong. Tap it, then type the word that belongs there.</p>

			<section className="mt-6 flex min-h-[16rem] flex-col rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--q-line-2)]" aria-live="polite">
				{!started && (
					<button type="button" onClick={() => void load()} className={`${BUTTON} bg-primary text-primary-foreground self-start`}>
						Start
					</button>
				)}
				{started && !next && <p className="font-ui text-sm text-muted-foreground">Getting an item…</p>}

				{next && !next.view && (
					<div className="flex flex-col gap-3">
						<p className="font-ui text-sm text-foreground">{error ?? next.reason}</p>
						<button type="button" onClick={() => void load()} disabled={busy} className={`${BUTTON} bg-card text-foreground shadow-[0_0_0_1px_var(--q-line-2)] self-start`}>
							Try again
						</button>
					</div>
				)}

				{next?.view && !result && (
					<div className="flex flex-col gap-5">
						<div className="flex flex-col gap-3">
							{next.view.sentences.map((tokens, s) => (
								<Sentence key={s} tokens={tokens} sentence={s} tap={tap} onTap={setTap} disabled={busy} />
							))}
						</div>
						{tap ? (
							<form
								className="flex flex-col gap-3 sm:flex-row"
								onSubmit={(e) => {
									e.preventDefault();
									if (typed.trim()) void check();
								}}
							>
								<input
									value={typed}
									onChange={(e) => setTyped(e.target.value)}
									aria-label="The word that belongs there"
									placeholder="The word that belongs there"
									autoComplete="off"
									autoCapitalize="none"
									spellCheck={false}
									disabled={busy}
									className="q-field min-h-11 min-w-0 flex-1 rounded-lg px-4 py-2.5 font-ui text-base"
								/>
								<button type="submit" disabled={busy || !typed.trim()} className={`${BUTTON} bg-primary text-primary-foreground`}>
									Check
								</button>
							</form>
						) : (
							<p className="font-ui text-sm text-muted-foreground">Tap the wrong word.</p>
						)}
						{error && <p className="font-ui text-sm text-destructive">{error}</p>}
					</div>
				)}

				{result && next?.view && (
					<div className="flex flex-col gap-5">
						<p className="font-ui text-base font-[600] text-foreground">
							{result.tapOk ? "You found the wrong word." : `The wrong word was "${result.wrong}".`}
						</p>
						<p className="font-ui text-sm text-foreground">
							{result.verdict === "exact"
								? `Right: "${result.right}".`
								: result.verdict === "accents"
									? `Right word, but check the accent: "${result.right}".`
									: `The word that belongs there is "${result.right}".`}
						</p>
						<p className="font-ui text-sm text-muted-foreground">{result.rule}</p>
						<ol className="flex flex-col gap-3">
							{result.sentences.map((s, i) => (
								<li key={i} className="flex flex-col">
									<span className="font-prose text-base text-foreground">{s.sk}</span>
									<span className="font-ui text-sm text-muted-foreground">{s.en}</span>
								</li>
							))}
						</ol>
						<button type="button" onClick={() => void load()} disabled={busy} className={`${BUTTON} bg-primary text-primary-foreground self-start`}>
							Next item
						</button>
					</div>
				)}
			</section>
			<SourcesNote feature="mixups" className="mt-6" />
		</div>
	);
}

function Sentence({ tokens, sentence, tap, onTap, disabled }: { tokens: CatchToken[]; sentence: number; tap: Tap | null; onTap: (t: Tap) => void; disabled: boolean }) {
	return (
		<p className="font-prose text-lg leading-relaxed text-foreground">
			{tokens.map((t, i) =>
				t.word ? (
					<button
						key={i}
						type="button"
						disabled={disabled}
						aria-pressed={tap?.sentence === sentence && tap.token === i}
						onClick={() => onTap({ sentence, token: i })}
						className={`lh-press min-h-11 rounded px-0.5 align-middle ${tap?.sentence === sentence && tap.token === i ? "bg-teal-wash font-[600]" : "hover:bg-muted"}`}
					>
						{t.text}
					</button>
				) : (
					<span key={i}>{t.text}</span>
				),
			)}
		</p>
	);
}
