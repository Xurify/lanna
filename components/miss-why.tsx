import { cn } from "@/lib/utils";
import { noteSpans, type MissReason, type MissWord } from "@/src/core";

type Tone = "yours" | "needed";

const UNDERLINE: Record<Tone, string> = { yours: "decoration-miss", needed: "decoration-teal" };
const DASH: Record<Tone, string> = { yours: "bg-miss", needed: "bg-teal" };

const senseHead = (sense: string) => sense.replace(/\s*\([^)]*\)/g, "").trim();
const sameWord = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function Side({
	label,
	word,
	detail,
	tone,
	code,
	className,
	testId,
}: {
	label: string;
	word: string;
	detail?: React.ReactNode;
	tone: Tone;
	code?: string;
	className?: string;
	testId: string;
}) {
	return (
		<div className={cn("min-w-0", className)} data-testid={testId}>
			<p className="text-[12px] font-medium text-ink-3">{label}</p>
			<p
				lang={code}
				className={cn(
					"mt-1 break-words font-title text-[22px] leading-tight underline decoration-2 underline-offset-[5px]",
					UNDERLINE[tone],
					tone === "yours" ? "text-ink-2" : "font-semibold text-ink",
				)}
			>
				{word}
			</p>
			{detail && <p className="mt-1.5 text-[14px] leading-snug text-ink-3">{detail}</p>}
		</div>
	);
}

function Source({ children }: { children: React.ReactNode }) {
	return <span className="mt-1.5 block text-[13px] text-ink-3">{children}</span>;
}

function Marked({ tone, children }: { tone: Tone | undefined; children: React.ReactNode }) {
	return (
		<span className="flex gap-2.5">
			<span
				aria-hidden="true"
				className={cn("mt-[0.6em] h-[2px] w-3 shrink-0 rounded-full", tone ? DASH[tone] : "bg-transparent")}
			/>
			<span className="min-w-0">{children}</span>
		</span>
	);
}

function yoursDetail(
	reason: MissReason,
	other: MissWord | undefined,
	given: string,
	w: (text: string) => React.ReactNode,
): React.ReactNode {
	if (other) {
		const spelledAsLemma = other.isLemma && sameWord(given, other.lemma);
		const which = !other.isLemma ? <>a form of {w(other.lemma)}, </> : spelledAsLemma ? null : <>{w(other.lemma)}, </>;
		return (
			<>
				{other.partOfSpeech ? `${other.partOfSpeech} · ` : null}
				{which}
				{other.alsoMeans?.includes("(") && !other.aspect ? other.alsoMeans : other.gloss}
			</>
		);
	}
	if (reason.slip === "base") return "the dictionary form, with no ending";
	if (reason.slip === "same-word") return <>{w(reason.lemma)} with another ending</>;
	if (reason.slip === "other")
		return reason.inflects ? <>not a form of {w(reason.lemma)}</> : "not a word the dictionary knows";
	return undefined;
}

export function MissWhy({
	reason,
	given,
	answer,
	code,
	className,
}: {
	reason: MissReason;
	given: string;
	answer: string;
	code?: string;
	className?: string;
}) {
	const typed = given.trim();
	const lemmaIsLower = reason.lemma.charAt(0) === reason.lemma.charAt(0).toLocaleLowerCase(code);
	const needed = lemmaIsLower
		? answer.trim().charAt(0).toLocaleLowerCase(code) + answer.trim().slice(1)
		: answer.trim();
	const other = reason.slip === "other" ? reason.other : undefined;
	const toneOf = (word: string): Tone | undefined =>
		sameWord(word, reason.lemma) ? "needed" : other && sameWord(word, other.lemma) ? "yours" : undefined;
	const w = (text: string, tone: Tone | undefined = toneOf(text)) => (
		<b
			lang={code}
			className={cn(
				"font-semibold text-ink-2",
				tone && cn("underline decoration-[1.5px] underline-offset-[3px]", UNDERLINE[tone]),
			)}
		>
			{text}
		</b>
	);
	const bold = (text: string) => (
		<b lang={code} className="font-semibold text-ink-2">
			{text}
		</b>
	);
	const example = other && !other.rule && !other.aspect && !other.reference && !other.note ? other.example : undefined;
	const onlyOneAsks = Boolean(example?.asks) !== Boolean(reason.asks);
	const verbOf = (cell: string) => cell.split(/\s+/)[0] ?? cell;

	const neededDetail = (
		<>
			{other?.herePartOfSpeech ? `${other.herePartOfSpeech} · ` : null}
			{sameWord(reason.lemma, needed) ? null : <>{bold(reason.lemma)}, </>}
			{other?.hereMeans ?? reason.gloss}
			{reason.form || reason.trigger ? (
				<span className="mt-0.5 block">
					{reason.form ? reason.form.replace(` of ${reason.lemma}`, "") : "this form"}
					{reason.trigger ? (
						<>
							, after{" "}
							<span className="rounded-[5px] bg-well px-1.5 font-semibold text-teal-2" lang={code}>
								{reason.trigger}
							</span>
						</>
					) : null}
				</span>
			) : null}
		</>
	);

	const contrast = other?.rule ? (
		<div data-testid="review-why-rule">
			{other.rule}
			<Source>From Mix-ups, the app&apos;s word pairs.</Source>
		</div>
	) : other?.aspect ? (
		<div data-testid="review-why-aspect" className="flex flex-col gap-1">
			{(["imperfective", "perfective"] as const).map((side) => (
				<Marked key={side} tone={toneOf(verbOf(other.aspect![side]))}>
					{bold(other.aspect![side])} · {side}
					{other.aspect!.roles ? `: ${other.aspect!.roles[side]}` : null}
				</Marked>
			))}
			<Source>From the reference: {other.aspect.chapter}.</Source>
		</div>
	) : other?.reference ? (
		<div data-testid="review-why-reference" className="flex flex-col gap-1">
			{other.reference.lines.map((line, i) => (
				<Marked key={i} tone={line.about === "a" ? "needed" : line.about === "b" ? "yours" : undefined}>
					{line.text}
				</Marked>
			))}
			<Source>From the reference: {other.reference.chapter}.</Source>
		</div>
	) : other?.note ? (
		<div data-testid="review-why-note">
			{noteSpans(other.note).map((part, i) =>
				part.word ? <span key={i}>{w(part.text)}</span> : <span key={i}>{part.text}</span>,
			)}
			<Source>AI note from the dictionary&apos;s sentences, not checked by a person.</Source>
		</div>
	) : other?.notePending ? (
		<div data-testid="review-why-note-pending" className="text-ink-3">
			Comparing the two words in the dictionary&apos;s sentences…
		</div>
	) : example ? (
		<div data-testid="review-why-example">
			<span className="block">
				{example.asks && onlyOneAsks ? <>{w(typed, "yours")} asks a question:</> : <>Your word in use:</>}
			</span>
			<i lang={code} className="mt-1 block">
				{example.text}
			</i>
			<span className="block text-ink-3">{example.en}</span>
		</div>
	) : null;

	const shared = other?.alsoMeans ? <div>Both can mean {senseHead(other.alsoMeans)}.</div> : null;
	const asksHere =
		reason.asks && example && onlyOneAsks ? <div>Here {w(needed, "needed")} asks a question.</div> : null;
	const why = [shared, contrast, asksHere].filter(Boolean);

	return (
		<div className={cn("lh-fade text-[15px] leading-snug text-foreground", className)} data-testid="review-why">
			<div className="flex items-stretch">
				{typed && (
					<Side
						label="You wrote"
						word={typed}
						detail={yoursDetail(reason, other, given, bold)}
						tone="yours"
						code={code}
						className="flex-1 pr-5 @xl:flex-none @xl:min-w-[10rem] @xl:pr-8"
						testId="review-why-yours"
					/>
				)}
				<Side
					label={typed ? "Needed here" : "The word here"}
					word={needed}
					detail={neededDetail}
					tone="needed"
					code={code}
					className={cn("flex-1 @xl:flex-none", typed && "border-l border-[var(--q-line)] pl-5 @xl:pl-8")}
					testId="review-why-needed"
				/>
			</div>
			{why.length > 0 && (
				<div
					className="mt-4 flex flex-col gap-2.5 border-t border-[var(--q-line)] pt-3.5"
					data-testid="review-why-because"
				>
					{why.map((line, i) => (
						<div key={i}>{line}</div>
					))}
				</div>
			)}
		</div>
	);
}
