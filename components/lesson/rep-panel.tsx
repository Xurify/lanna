import { cn } from "@/lib/utils";
import { PaintSwatch } from "@/components/lesson/paint-swatch";
import { WeatherScene } from "@/components/lesson/weather-scene";
import {
	firstLetterOf,
	helpPrice,
	isAnsweredForm,
	lessonLanguage,
	type HelpStep,
	type LessonItem,
	type WordPicture,
} from "@/src/core";

export function PictureBox({ picture, label, className }: { picture: WordPicture; label: string; className?: string }) {
	return (
		<figure
			className={cn("flex items-center justify-center rounded-[14px] bg-well", className)}
			data-testid="word-picture"
			data-picture={picture.kind === "paint" ? picture.paint : picture.scene}
		>
			{picture.kind === "paint" ? (
				<PaintSwatch paint={picture.paint} label={label} className="block h-[62%] w-[min(62%,14rem)]" />
			) : (
				<span role="img" aria-label={label} className="block h-full w-full max-w-[22rem] p-2">
					<WeatherScene scene={picture.scene} className="block h-full w-full" />
				</span>
			)}
		</figure>
	);
}

const STEP_LABEL: Record<HelpStep, string> = {
	translation: "English sentence",
	form: "Which form",
	"first-letter": "First letter",
};

export function HelpLadder({
	steps,
	used,
	missed,
	canReturn,
	item,
	onUse,
	className,
}: {
	steps: readonly HelpStep[];
	used: readonly HelpStep[];
	missed: boolean;
	canReturn: boolean;
	item: LessonItem;
	onUse: (step: HelpStep) => void;
	className?: string;
}) {
	const shown = (step: HelpStep) =>
		step === "translation" ? (
			item.translation
		) : step === "form" ? (
			item.form
		) : (
			<span lang={lessonLanguage()} className="font-semibold text-foreground">
				{firstLetterOf(item.answer)}…
			</span>
		);
	return (
		<div className={className} data-testid="help-ladder">
			<p className="mb-2 font-ui text-[12.5px] font-semibold text-ink-3">Help</p>
			<ol className="flex flex-col gap-2">
				{steps.map((step) => {
					const price = helpPrice(step, used, missed);
					return (
						<li key={step}>
							{price === "used" ? (
								<div
									className="flex min-h-11 flex-col justify-center rounded-[10px] bg-teal-wash px-3.5 py-2"
									data-testid={`help-${step}`}
									data-used="true"
								>
									<span className="font-ui text-[12.5px] font-[550] text-teal-2">{STEP_LABEL[step]}</span>
									<span className="font-prose text-[15px] leading-snug text-foreground">{shown(step)}</span>
								</div>
							) : (
								<button
									type="button"
									onClick={() => onUse(step)}
									className="lanna-press flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] bg-card px-3.5 py-2 text-left font-ui text-[14px] font-[550] text-ink-2 shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well"
									data-testid={step === "translation" ? "lesson-peek" : `help-${step}`}
								>
									<span>{STEP_LABEL[step]}</span>
									<span className="shrink-0 text-[12.5px] font-[450] text-ink-3">{price}</span>
								</button>
							)}
						</li>
					);
				})}
			</ol>
			<p className="mt-2 font-ui text-[12.5px] text-ink-3">
				{canReturn && (used.length > 0 || missed)
					? "This word comes back at the end."
					: "Help halves this answer's XP."}
			</p>
		</div>
	);
}

const CELL = "rounded-[5px] px-1.5 py-0.5";

export function WordCard({ item, tag, className }: { item: LessonItem; tag: string; className?: string }) {
	const card = item.card;
	if (!card) return null;
	const lang = lessonLanguage();
	const answered = item.pair ? (item.form ?? item.answer) : item.answer;
	const meta = [card.partOfSpeech, card.gender].filter(Boolean).join(" · ");
	const cell = (form: string | null) =>
		form ? (
			<span className={cn(CELL, isAnsweredForm(form, answered, tag) && "bg-teal-wash font-semibold text-teal-2")}>
				{form}
			</span>
		) : (
			<span className="px-1.5 text-ink-4">–</span>
		);
	return (
		<section
			className={cn("rounded-[14px] bg-card px-5 py-4 shadow-[0_0_0_1px_var(--q-line-2)]", className)}
			data-testid="word-card"
			data-word-lookup-enabled="true"
		>
			<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
				<h2 className="font-prose text-[26px] font-semibold tracking-[-0.02em] text-foreground" lang={lang}>
					{item.lemma}
				</h2>
				{meta && <span className="font-ui text-[13px] text-ink-3">{meta}</span>}
			</div>
			<p className="font-prose text-[15px] text-ink-2" data-no-word-lookup="true">
				{item.gloss}
			</p>
			{card.table ? (
				<table className="mt-3 w-full font-prose text-[15px]" lang={lang} data-testid="word-card-table">
					<thead>
						<tr className="font-ui text-[12px] text-ink-3">
							<th className="w-[38%] pb-1 text-left font-[450]" />
							<th className="pb-1 text-left font-[450]">singular</th>
							<th className="pb-1 text-left font-[450]">plural</th>
						</tr>
					</thead>
					<tbody>
						{card.table.map((row) => (
							<tr key={row.grammarCase}>
								<th scope="row" className="py-0.5 text-left font-ui text-[12.5px] font-[450] text-ink-3" lang="en">
									{row.grammarCase}
								</th>
								<td className="py-0.5 text-foreground">{cell(row.singular)}</td>
								<td className="py-0.5 text-foreground">{cell(row.plural)}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : card.forms ? (
				<div className="mt-3" data-testid="word-card-forms">
					<p className="font-ui text-[12.5px] font-[450] text-ink-3">Forms</p>
					<p className="mt-1 flex flex-wrap gap-x-1 gap-y-1 font-prose text-[15px] text-foreground" lang={lang}>
						{card.forms.map((form) => (
							<span key={form}>{cell(form)}</span>
						))}
					</p>
				</div>
			) : null}
			{card.examples.length > 0 && (
				<ul className="mt-3 flex flex-col gap-2 border-t border-[var(--q-line)] pt-3" data-testid="word-card-examples">
					{card.examples.map((ex) => (
						<li key={ex.before + ex.word + ex.after} className="font-prose text-[15px] leading-snug">
							<span className="text-foreground" lang={lang}>
								{ex.before}
								<b className="font-semibold">{ex.word}</b>
								{ex.after}
							</span>
							<span className="block text-ink-3" data-no-word-lookup="true">
								{ex.en}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
