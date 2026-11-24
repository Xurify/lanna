"use client";

/**
 * Catch the mistake (app/catch): two or three sentences with one wrong word. The learner taps the wrong
 * word, types the word that belongs there, and then sees the whole item. The card keeps its height while
 * an item loads, so nothing below it moves.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DiacriticBar } from "@/components/diacritic-bar";
import { readOrigin } from "@/components/origin";
import { SidebarToggle } from "@/components/sidebar";
import { SourcesNote } from "@/components/sources/sources-note";
import { useActiveLanguage } from "@/components/speech";
import { TodayLink } from "@/components/today-link";
import type { CatchNext, CatchResult, CatchToken } from "@/src/core";

type Tap = { sentence: number; token: number };

const BUTTON = "min-h-11 rounded-lg px-4 font-ui text-sm font-[600] transition-colors disabled:opacity-50";

export function CatchPlayer() {
	const router = useRouter();
	const lang = useActiveLanguage();
	const langCode = lang?.code;
	const [next, setNext] = useState<CatchNext | null>(null);
	const [result, setResult] = useState<CatchResult | null>(null);
	const [tap, setTap] = useState<Tap | null>(null);
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [started, setStarted] = useState(false);

	const load = useCallback(async () => {
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
				setError(body.message ?? "Couldn't make a new text.");
				setNext({ view: null });
			} else {
				setNext(body);
			}
		} catch {
			setError("Couldn't make a new text. Check the connection and try again.");
			setNext({ view: null });
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				if (event.target instanceof HTMLInputElement && tap) {
					event.preventDefault();
					setTap(null);
					return;
				}
				event.preventDefault();
				router.push(readOrigin());
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [router, tap]);

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
			if (!res.ok) setError(body.message ?? "Your answer wasn't saved.");
			else setResult(body);
		} catch {
			setError("Your answer wasn't saved. Check the connection and try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lanna-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-2">
				<TodayLink />
				<h1 className="mt-3 font-ui text-2xl font-[600] text-foreground">Catch the mistake</h1>
				<p className="mt-2 font-ui text-sm text-muted-foreground">
					One word in this text is wrong. Tap it, then type the word that belongs there.
				</p>

				<section
					className="mt-6 flex min-h-[16rem] flex-col rounded-xl bg-card p-5 shadow-[0_0_0_1px_var(--q-line-2)]"
					aria-live="polite"
				>
					{!started && (
						<button
							type="button"
							onClick={() => void load()}
							className={`${BUTTON} bg-primary text-primary-foreground self-start`}
						>
							Show a text
						</button>
					)}
					{started && !next && <p className="font-ui text-sm text-muted-foreground">Getting a text…</p>}

					{next && !next.view && (
						<div className="flex flex-col gap-3">
							<p className="font-ui text-sm text-foreground">{error ?? next.reason}</p>
							<button
								type="button"
								onClick={() => void load()}
								disabled={busy}
								className={`${BUTTON} bg-card text-foreground shadow-[0_0_0_1px_var(--q-line-2)] self-start`}
							>
								Try again
							</button>
						</div>
					)}

					{next?.view && !result && (
						<div className="flex flex-col gap-5">
							<div className="flex flex-col gap-3">
								{next.view.sentences.map((tokens, sentenceIndex) => (
									<Sentence
										key={sentenceIndex}
										tokens={tokens}
										sentence={sentenceIndex}
										tap={tap}
										onTap={setTap}
										disabled={busy}
										lang={langCode}
									/>
								))}
							</div>
							{tap ? (
								<form
									className="flex flex-col gap-3"
									onSubmit={(event) => {
										event.preventDefault();
										if (typed.trim()) void check();
									}}
								>
									<div className="flex flex-col gap-3 sm:flex-row">
										<input
											value={typed}
											onChange={(event) => setTyped(event.target.value)}
											aria-label="The word that belongs there"
											placeholder="The word that belongs there"
											autoComplete="off"
											autoCapitalize="none"
											spellCheck={false}
											disabled={busy}
											lang={langCode}
											className="q-field min-h-11 min-w-0 flex-1 rounded-lg px-4 py-2.5 font-ui text-base"
										/>
										<button
											type="submit"
											disabled={busy || !typed.trim()}
											className={`${BUTTON} bg-primary text-primary-foreground`}
										>
											Check
										</button>
									</div>
									<DiacriticBar variant="keys" />
								</form>
							) : (
								<p className="font-ui text-sm text-muted-foreground">Tap the wrong word.</p>
							)}
							{error && <p className="font-ui text-sm text-miss">{error}</p>}
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
								{result.sentences.map((sentence, index) => (
									<li key={index} className="flex flex-col">
										<span className="font-prose text-base text-foreground" lang={langCode}>
											{sentence.sk}
										</span>
										<span className="font-ui text-sm text-muted-foreground">{sentence.en}</span>
									</li>
								))}
							</ol>
							<button
								type="button"
								onClick={() => void load()}
								disabled={busy}
								className={`${BUTTON} bg-primary text-primary-foreground self-start`}
							>
								Next text
							</button>
						</div>
					)}
				</section>
				<SourcesNote feature="mixups" className="mt-6" />
			</div>
		</div>
	);
}

function Sentence({
	tokens,
	sentence,
	tap,
	onTap,
	disabled,
	lang,
}: {
	tokens: CatchToken[];
	sentence: number;
	tap: Tap | null;
	onTap: (t: Tap) => void;
	disabled: boolean;
	lang?: string;
}) {
	return (
		<p className="font-prose text-lg leading-relaxed text-foreground" lang={lang}>
			{tokens.map((token, index) =>
				token.word ? (
					<button
						key={index}
						type="button"
						disabled={disabled}
						aria-pressed={tap?.sentence === sentence && tap.token === index}
						onClick={() => onTap({ sentence, token: index })}
						className={`lanna-press min-h-11 rounded px-0.5 align-middle ${tap?.sentence === sentence && tap.token === index ? "bg-teal-wash font-[600]" : "hover:bg-well"}`}
					>
						{token.text}
					</button>
				) : (
					<span key={index}>{token.text}</span>
				),
			)}
		</p>
	);
}
