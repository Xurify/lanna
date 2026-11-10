"use client";

import { useMemo, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiacriticBar } from "@/components/diacritic-bar";
import { SourcesNote } from "@/components/sources/sources-note";
import { speak, useActiveLanguage } from "@/components/speech";
import { PLAY_ROW, SECONDARY, SentenceRow, SentenceRows, VerdictDisc } from "@/components/task-frame";
import { analyzeRhythmicLaw, formatStressCadence, type RhythmicAnalysis } from "@/src/core";

interface Form {
	stem: string;
	word: string;
	translation: string;
}

interface EndingContrast {
	label: string;
	afterShort: Form;
	afterLong: Form;
}

const ENDING_CONTRASTS: EndingContrast[] = [
	{
		label: "Adjectives",
		afterShort: { stem: "pekn", word: "pekný", translation: "nice, pretty" },
		afterLong: { stem: "krásn", word: "krásny", translation: "beautiful" },
	},
	{
		label: "Nouns, dative plural",
		afterShort: { stem: "žen", word: "ženám", translation: "to women" },
		afterLong: { stem: "tráv", word: "trávam", translation: "to grasses" },
	},
	{
		label: "Verbs, first person singular",
		afterShort: { stem: "rob", word: "robím", translation: "I do, I make" },
		afterLong: { stem: "chvál", word: "chválim", translation: "I praise" },
	},
	{
		label: "A diphthong in the stem counts as long",
		afterShort: { stem: "nov", word: "nový", translation: "new" },
		afterLong: { stem: "biel", word: "biely", translation: "white" },
	},
	{
		label: "A long ŕ or ĺ in the stem counts as long",
		afterShort: { stem: "srn", word: "srnám", translation: "to roe deer" },
		afterLong: { stem: "vŕb", word: "vŕbam", translation: "to willows" },
	},
];

const WORDS_TO_TRY = ["krásny", "chválim", "ženám", "trávam", "vŕbam", "biely", "básňam", "krásný", "lístie", "páví"];

const AFTER_SHORT = "short stem, long ending";
const AFTER_LONG = "long stem, short ending";

const STRESS_SENTENCE ={ text: "Chválime krásne Slovensko", translation: "We praise beautiful Slovakia" };

function play(text: string) {
	void speak(text).catch(() => {});
}

export function RhythmicVisualizer() {
	const lang = useActiveLanguage();
	const [word, setWord] = useState(WORDS_TO_TRY[0]!);
	const analysis = useMemo(() => analyzeRhythmicLaw(word), [word]);
	const typed = word.trim().toLocaleLowerCase(lang?.code);

	return (
		<div data-testid="rhythmic-visualizer">
			<p className="q-date">Rhythm rule</p>
			<h1 className="q-hello">Two long syllables never stand side by side</h1>
			<p className="q-line dim mt-3">
				When a long ending meets a long stem, the ending turns short:{" "}
				<span className="q-sk" lang={lang?.code}>
					krásn- + -ý
				</span>{" "}
				gives{" "}
				<span className="q-sk" lang={lang?.code}>
					krásny
				</span>
				. A few endings are exceptions, and the checker below names them.
			</p>
			<p className="q-sub">
				Long: <b lang={lang?.code}>á é í ó ú ý</b>, the diphthongs <b lang={lang?.code}>ia ie iu ô</b>, and long <b lang={lang?.code}>ŕ ĺ</b>.
			</p>

			<section className="mt-10">
				<h2 className="q-sh">Try a word</h2>
				<Beats analysis={analysis} />
				<div className="mt-3 flex gap-2">
					<input
						type="text"
						lang={lang?.code}
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						value={word}
						onChange={(e) => setWord(e.target.value)}
						aria-label="A word to check"
						placeholder="Type a word"
						className="q-field h-12 min-w-0 flex-1 px-4 font-prose text-[19px] font-medium tracking-[-0.01em] placeholder:font-normal placeholder:text-ink-3"
						data-testid="rhythm-input"
					/>
					<button type="button" onClick={() => play(analysis.word)} disabled={analysis.syllables.length === 0} className={cn(SECONDARY, "h-12 shrink-0")}>
						<Volume2Icon className="size-4 text-ink-3" strokeWidth={1.6} />
						Hear it
					</button>
				</div>
				<ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Words to try">
					{WORDS_TO_TRY.map((w) => (
						<li key={w}>
							<button
								type="button"
								onClick={() => setWord(w)}
								aria-pressed={typed === w}
								lang={lang?.code}
								className={cn("lh-press rounded-md px-2.5 py-1 font-prose text-[15px] font-medium pointer-coarse:py-2.5", typed === w ? "bg-teal-wash text-teal-2" : "bg-well text-ink-2 hover:bg-well-2")}
							>
								{w}
							</button>
						</li>
					))}
				</ul>
				<DiacriticBar variant="keys" className="mt-4" />
			</section>

			<section className="mt-10">
				<h2 className="q-sh">Same ending, two lengths</h2>
				<div className="hidden grid-cols-2 gap-x-8 font-ui text-[12.5px] font-[550] text-ink-2 sm:grid" aria-hidden="true">
					<p className="first-letter:uppercase">{AFTER_SHORT}</p>
					<p className="first-letter:uppercase">{AFTER_LONG}</p>
				</div>
				<ul className="divide-y divide-[var(--q-line)]">
					{ENDING_CONTRASTS.map((c) => (
						<li key={c.label} className="py-4">
							<p className="font-ui text-[13px] text-ink-3">{c.label}</p>
							<div className="mt-2.5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
								<FormLine form={c.afterShort} note={AFTER_SHORT} />
								<FormLine form={c.afterLong} note={AFTER_LONG} />
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="mt-10">
				<h2 className="q-sh">Stress is on the first syllable</h2>
				<p className="q-line dim">The first syllable of every word carries the stress, and each vowel keeps its full sound. The mark ˈ shows where the stress falls.</p>
				<SentenceRows className="mt-1">
					<SentenceRow sentence={STRESS_SENTENCE.text} lang={lang?.code} translation={STRESS_SENTENCE.translation} onPlay={() => play(STRESS_SENTENCE.text)}>
						{formatStressCadence(STRESS_SENTENCE.text)}
					</SentenceRow>
				</SentenceRows>
			</section>

			<SourcesNote feature="rhythmic-law" className="mt-14" />
		</div>
	);
}

function Beats({ analysis }: { analysis: RhythmicAnalysis }) {
	const lang = useActiveLanguage();
	const clashing = new Set(analysis.hasViolation ? analysis.violations.flatMap((v) => [v.first.index, v.second.index]) : []);
	const longs = analysis.syllables.filter((s) => s.quantity === "long").length;
	const note =
		analysis.hasViolation || analysis.isException
			? analysis.explanation
			: longs === 0
				? "No syllable in this word is long."
				: longs === 1
					? "Only one syllable is long, so nothing has to turn short."
					: "The long syllables are not next to each other.";
	return (
		<div className="min-h-[15.75rem] rounded-xl bg-well px-5 py-6 sm:min-h-[14.25rem] sm:px-7" data-testid="syllable-bar" aria-live="polite">
			{analysis.syllables.length === 0 ? (
				<p className="font-ui text-[13px] text-ink-3">Type a word to see its syllables, long and short.</p>
			) : (
				<>
					<ol className="flex flex-wrap items-start gap-x-5 gap-y-4" aria-label={`Syllables of ${analysis.word}`}>
						{analysis.syllables.map((s, i) => {
							const long = s.quantity === "long";
							const clash = clashing.has(s.index);
							const clashesWithPrevious = clash && i > 0 && clashing.has(analysis.syllables[i - 1]!.index);
							return (
								<li key={s.index} className="flex flex-col items-center">
									<span
										className={cn(
											"relative font-prose text-[36px] font-semibold leading-none tracking-[-0.03em] sm:text-[44px]",
											clash ? "text-miss" : "text-foreground",
											i > 0 && "before:absolute before:end-full before:w-5 before:text-center before:font-normal before:text-ink-4 before:content-['·']",
										)}
										lang={lang?.code}
									>
										{s.text}
									</span>
									<span aria-hidden="true" className="relative mt-3 flex h-1.5 w-full justify-center">
										{clashesWithPrevious && <span className="absolute end-full top-1/2 w-5 -translate-y-1/2 text-center font-ui text-[13px] font-bold leading-none text-miss">×</span>}
										<span className={cn("h-1.5 rounded-full", long ? "w-8 bg-teal" : "w-1.5 bg-ink-4")} />
									</span>
									<span className={cn("mt-1.5 whitespace-nowrap font-ui text-[12px]", long ? "font-[550] text-teal-2" : "text-ink-3")}>
										{long ? "long" : "short"} <span lang={lang?.code}>{s.nucleus}</span>
									</span>
								</li>
							);
						})}
					</ol>
					<p
						className={cn("mt-5 flex items-center gap-2.5 font-ui text-[14px] font-[600] tracking-[-0.01em]", analysis.hasViolation ? "text-miss" : analysis.isException ? "text-ink-2" : "text-teal-2")}
						data-testid="rhythm-verdict"
					>
						<VerdictDisc ok={!analysis.hasViolation} />
						{analysis.hasViolation ? "Two long syllables side by side" : analysis.isException ? "Two long syllables, allowed in this word" : "No two long syllables side by side"}
					</p>
					<p className="q-t2 !mt-2">
						{note}
						{analysis.suggestion && (
							<>
								{" "}By the rule it is{" "}
								<span lang={lang?.code} className="font-semibold text-foreground">
									{analysis.suggestion}
								</span>
								.
							</>
						)}
					</p>
				</>
			)}
		</div>
	);
}

function FormLine({ form, note }: { form: Form; note: string }) {
	const lang = useActiveLanguage();
	return (
		<div className="flex items-center gap-3">
			<button type="button" onClick={() => play(form.word)} className={PLAY_ROW} aria-label={`Play ${form.word}`} title="Play">
				<Volume2Icon className="size-4" strokeWidth={1.6} />
			</button>
			<div className="min-w-0">
				<p className="font-prose text-[22px] font-[550] leading-tight tracking-[-0.02em] text-foreground" lang={lang?.code}>
					{form.stem}
					<span className="font-semibold text-teal-2 underline decoration-teal-line decoration-2 underline-offset-[5px]">{form.word.slice(form.stem.length)}</span>
				</p>
				<p className="mt-1 font-ui text-[12.5px] text-ink-3">
					{form.translation}
					<span className="sm:sr-only"> · {note}</span>
				</p>
			</div>
		</div>
	);
}
