"use client";

/**
 * Slovak Rhythmic Law & Suprasegmental Visualizer (LangHarness, 2026-11).
 *
 * Implements interactive visual demonstration of:
 * 1. Syllable quantity analysis (mora count: short ● vs long ●●).
 * 2. Slovak Rhythmic Law (Rytmický zákon): prohibition of consecutive long syllables.
 * 3. Suffix shortening alternations across noun, verb, and adjective paradigms.
 * 4. Fixed word-initial stress cadence to overcome L2 stress deafness (Dupoux et al. 2001, 2008).
 */

import { useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, SparklesIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/components/speech";
import {
	analyzeRhythmicLaw,
	applyRhythmicLaw,
	formatStressCadence,
	type RhythmicAnalysis,
} from "@/src/core";

interface PresetContrast {
	category: string;
	shortStemExample: {
		stem: string;
		suffix: string;
		word: string;
		translation: string;
	};
	longStemExample: {
		stem: string;
		suffix: string;
		word: string;
		translation: string;
	};
	ruleNote: string;
}

const PRESET_CONTRASTS: PresetContrast[] = [
	{
		category: "Adjectives (-ý / -y)",
		shortStemExample: { stem: "pekn", suffix: "ý", word: "pekný", translation: "nice / pretty" },
		longStemExample: { stem: "krásn", suffix: "ý", word: "krásny", translation: "beautiful" },
		ruleNote: "Stem 'krásn-' has long vowel 'á', so ending '-ý' shortens to '-y'.",
	},
	{
		category: "Noun Dative Plural (-ám / -am)",
		shortStemExample: { stem: "žen", suffix: "ám", word: "ženám", translation: "to women" },
		longStemExample: { stem: "tráv", suffix: "ám", word: "trávam", translation: "to grasses" },
		ruleNote: "Stem 'tráv-' has long vowel 'á', so ending '-ám' shortens to '-am'.",
	},
	{
		category: "Verb Present 1sg (-ím / -im)",
		shortStemExample: { stem: "rob", suffix: "ím", word: "robím", translation: "I do / make" },
		longStemExample: { stem: "chvál", suffix: "ím", word: "chválim", translation: "I praise" },
		ruleNote: "Stem 'chvál-' has long vowel 'á', so ending '-ím' shortens to '-im'.",
	},
	{
		category: "Diphthong Stems (ia, ie, ô)",
		shortStemExample: { stem: "nov", suffix: "ý", word: "nový", translation: "new" },
		longStemExample: { stem: "biel", suffix: "ý", word: "biely", translation: "white" },
		ruleNote: "Diphthong 'ie' counts as long, so ending '-ý' shortens to '-y'.",
	},
	{
		category: "Syllabic Liquid Stems (ŕ, ĺ)",
		shortStemExample: { stem: "srn", suffix: "ám", word: "srnám", translation: "to roe deer (pl)" },
		longStemExample: { stem: "vŕb", suffix: "ám", word: "vŕbam", translation: "to willows" },
		ruleNote: "Long syllabic 'ŕ' counts as a long beat, so ending '-ám' shortens to '-am'.",
	},
];

const EXPLORER_WORDS = [
	"krásny",
	"chválim",
	"ženám",
	"trávam",
	"vŕbam",
	"biely",
	"básňam",
	"krásný",
	"lístie",
	"páví",
];

export function RhythmicVisualizer() {
	const [inputWord, setInputWord] = useState("krásny");
	const [analysis, setAnalysis] = useState<RhythmicAnalysis>(() => analyzeRhythmicLaw("krásny"));
	const [playingWord, setPlayingWord] = useState<string | null>(null);

	const handleAnalyze = (w: string) => {
		setInputWord(w);
		setAnalysis(analyzeRhythmicLaw(w));
	};

	const playAudio = async (text: string) => {
		setPlayingWord(text);
		try {
			await speak(text);
		} finally {
			setPlayingWord(null);
		}
	};

	return (
		<div className="space-y-10" data-testid="rhythmic-visualizer">
			{/* Overview Banner */}
			<div className="rounded-2xl border border-[var(--q-line)] bg-well p-6 sm:p-8">
				<div className="flex items-start gap-4">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-wash text-teal-2">
						<SparklesIcon className="size-6" />
					</div>
					<div>
						<h2 className="font-prose text-2xl font-semibold text-foreground">
							The Slovak Rhythmic Law (<span className="italic">Rytmický zákon</span>)
						</h2>
						<p className="mt-2 font-prose text-base leading-relaxed text-ink-2">
							Standard Slovak enforces an ancient constraint: <strong className="text-foreground">two consecutive long syllables cannot occur in a row inside the same word</strong>.
							When an ending with a long vowel (e.g. <em>-ám</em>, <em>-ím</em>, <em>-ý</em>) attaches to a long stem, the ending obligatorily shortens.
						</p>
						<p className="mt-2 font-ui text-xs text-ink-3">
							Long beats: <span className="font-semibold text-foreground">á, é, í, ó, ú, ý</span>, diphthongs <span className="font-semibold text-foreground">ia, ie, iu, ô</span>, and long liquids <span className="font-semibold text-foreground">ŕ, ĺ</span>.
						</p>
					</div>
				</div>
			</div>

			{/* Interactive Word Analyzer */}
			<div className="rounded-2xl border border-[var(--q-line)] bg-surface p-6 shadow-sm sm:p-8">
				<h3 className="font-ui text-sm font-semibold uppercase tracking-wider text-ink-3">
					Interactive Syllable Quantity Analyzer
				</h3>

				<div className="mt-4 flex flex-wrap gap-2">
					{EXPLORER_WORDS.map((w) => (
						<button
							key={w}
							type="button"
							onClick={() => handleAnalyze(w)}
							className={cn(
								"rounded-lg px-3 py-1.5 font-ui text-sm transition-colors",
								inputWord.toLowerCase() === w.toLowerCase()
									? "bg-teal text-white shadow-sm"
									: "bg-well text-ink-2 hover:bg-well-2 hover:text-foreground",
							)}
						>
							{w}
						</button>
					))}
				</div>

				<div className="mt-6 flex flex-col gap-3 sm:flex-row">
					<input
						type="text"
						value={inputWord}
						onChange={(e) => handleAnalyze(e.target.value)}
						placeholder="Type a Slovak word..."
						className="flex-1 rounded-xl border border-[var(--q-line)] bg-well px-4 py-3 font-prose text-lg text-foreground focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
					/>
					<button
						type="button"
						onClick={() => playAudio(analysis.word)}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-5 py-3 font-ui font-medium text-white shadow-sm transition-opacity hover:opacity-95"
					>
						<Volume2Icon className="size-5" />
						Hear Word
					</button>
				</div>

				{/* Visual Syllable Bar */}
				{analysis.syllables.length > 0 && (
					<div className="mt-8 rounded-xl bg-well p-5 sm:p-6" data-testid="syllable-bar">
						<p className="font-ui text-xs font-semibold text-ink-3 uppercase tracking-wider">
							Syllable Quantity Breakdown
						</p>
						<div className="mt-4 flex flex-wrap items-center gap-3">
							{analysis.syllables.map((s, idx) => {
								const isLong = s.quantity === "long";
								return (
									<div
										key={idx}
										className={cn(
											"flex flex-col items-center rounded-xl border px-4 py-3 min-w-[70px]",
											isLong
												? "border-teal-line bg-teal-wash text-teal-2"
												: "border-[var(--q-line)] bg-surface text-ink-2",
										)}
									>
										<span className="font-prose text-2xl font-semibold text-foreground">
											{s.text}
										</span>
										<span className="mt-1 font-ui text-[11px] font-medium uppercase tracking-wider">
											{isLong ? "●● long (2μ)" : "● short (1μ)"}
										</span>
									</div>
								);
							})}
						</div>

						{/* Verdict Banner */}
						<div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--q-line)] bg-surface p-4">
							{analysis.hasViolation ? (
								<AlertCircleIcon className="size-5 shrink-0 text-miss" />
							) : (
								<CheckCircleIcon className="size-5 shrink-0 text-teal-2" />
							)}
							<div>
								<p className={cn("font-ui text-sm font-semibold", analysis.hasViolation ? "text-miss" : "text-teal-2")}>
									{analysis.hasViolation ? "Rhythmic Law Violation" : analysis.isException ? "Valid Standard Exception" : "Complies with Rhythmic Law"}
								</p>
								<p className="mt-1 font-prose text-sm text-ink-2">
									{analysis.explanation}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Paradigmatic Contrasts Grid */}
			<div className="rounded-2xl border border-[var(--q-line)] bg-surface p-6 shadow-sm sm:p-8">
				<h3 className="font-ui text-sm font-semibold uppercase tracking-wider text-ink-3">
					Classic Paradigmatic Contrasts
				</h3>
				<p className="mt-1 font-prose text-sm text-ink-2">
					Listen to how identical suffixes shorten after long syllables versus remaining long after short syllables.
				</p>

				<div className="mt-6 grid gap-4">
					{PRESET_CONTRASTS.map((c) => {
						return (
							<div
								key={c.category}
								className="rounded-xl border border-[var(--q-line)] bg-well p-5 transition-shadow hover:shadow-sm"
							>
								<div className="flex items-center justify-between">
									<h4 className="font-ui text-sm font-semibold text-ink-2">{c.category}</h4>
									<span className="font-ui text-xs text-ink-3">{c.ruleNote}</span>
								</div>

								<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
									{/* Short stem -> long ending */}
									<div className="flex items-center justify-between rounded-lg border border-[var(--q-line)] bg-surface px-4 py-3">
										<div>
											<div className="flex items-baseline gap-2">
												<span className="font-prose text-lg font-semibold text-foreground">
													{c.shortStemExample.word}
												</span>
												<span className="font-ui text-xs text-ink-3">
													({c.shortStemExample.translation})
												</span>
											</div>
											<p className="font-ui text-xs text-teal-2">
												short stem + <strong className="underline">long ending</strong>
											</p>
										</div>
										<button
											type="button"
											onClick={() => playAudio(c.shortStemExample.word)}
											className="flex size-9 items-center justify-center rounded-lg bg-well text-ink-2 hover:bg-well-2 hover:text-foreground"
										>
											<Volume2Icon className="size-4" />
										</button>
									</div>

									{/* Long stem -> shortened ending */}
									<div className="flex items-center justify-between rounded-lg border border-teal-line bg-teal-wash/30 px-4 py-3">
										<div>
											<div className="flex items-baseline gap-2">
												<span className="font-prose text-lg font-semibold text-foreground">
													{c.longStemExample.word}
												</span>
												<span className="font-ui text-xs text-ink-3">
													({c.longStemExample.translation})
												</span>
											</div>
											<p className="font-ui text-xs text-teal-2">
												long stem ➔ <strong className="underline">shortened ending</strong>
											</p>
										</div>
										<button
											type="button"
											onClick={() => playAudio(c.longStemExample.word)}
											className="flex size-9 items-center justify-center rounded-lg bg-well text-ink-2 hover:bg-well-2 hover:text-foreground"
										>
											<Volume2Icon className="size-4" />
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Suprasegmental Cadence & Stress Section */}
			<div className="rounded-2xl border border-[var(--q-line)] bg-surface p-6 shadow-sm sm:p-8">
				<h3 className="font-ui text-sm font-semibold uppercase tracking-wider text-ink-3">
					Syllable-Timed Cadence & Word-Initial Stress
				</h3>
				<p className="mt-1 font-prose text-sm text-ink-2">
					Unlike English or Russian (which feature mobile stress and vowel reduction), Slovak has <strong className="text-foreground">fixed stress on the first syllable</strong> and is <strong className="text-foreground">syllable-timed</strong>. Every syllable preserves its clean vowel color.
				</p>

				<div className="mt-6 rounded-xl bg-well p-5">
					<p className="font-ui text-xs text-ink-3">Example Sentence with Syllable Beats & Primary Stress (ˈ):</p>
					<p className="mt-2 font-prose text-2xl font-semibold tracking-wide text-foreground">
						{formatStressCadence("Chválime krásne Slovensko")}
					</p>
					<p className="mt-1 font-prose text-sm text-ink-2">
						"We praise beautiful Slovakia"
					</p>
					<button
						type="button"
						onClick={() => playAudio("Chválime krásne Slovensko")}
						className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 font-ui text-sm font-medium text-white transition-opacity hover:opacity-95"
					>
						<Volume2Icon className="size-4" />
						Hear Syllable-Timed Rhythm
					</button>
				</div>
			</div>
		</div>
	);
}
