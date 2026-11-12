import { cn } from "@/lib/utils";
import { noteSpans, type MissReason, type MissWord } from "@/src/core";

const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;

function OtherWord({ other, given, yours, w }: { other: MissWord; given: string; yours: React.ReactNode; w: (text: string) => React.ReactNode }) {
	const spelledAsLemma = other.isLemma && given.trim().toLowerCase() === other.lemma.toLowerCase();
	const pos = other.partOfSpeech;
	const the = pos ? `the ${pos} ` : "";
	const named = !other.isLemma ? (
		<>
			is a form of {the}
			{w(other.lemma)}
		</>
	) : !spelledAsLemma ? (
		<>
			is {the}
			{w(other.lemma)}
		</>
	) : pos ? (
		<>is {withArticle(pos)}</>
	) : null;
	if (other.alsoMeans) {
		return named ? (
			<>
				{yours} {named}, which also means {other.alsoMeans}, but it is another word.
			</>
		) : (
			<>
				{yours} also means {other.alsoMeans}, but it is another word.
			</>
		);
	}
	return named ? (
		<>
			{yours} {named}, {other.gloss}. It is another word.
		</>
	) : (
		<>
			{yours} means {other.gloss}. It is another word.
		</>
	);
}

export function MissWhy({ reason, given, code, className }: { reason: MissReason; given: string; code?: string; className?: string }) {
	const w = (text: string) => (
		<b className="font-semibold" lang={code}>
			{text}
		</b>
	);
	const yours = <span lang={code}>“{given.trim()}”</span>;
	const other = reason.slip === "other" ? reason.other : undefined;
	const what = other ? (
		<OtherWord other={other} given={given} yours={yours} w={w} />
	) : reason.slip === "other" && reason.inflects ? (
		<>
			{yours} is not a form of {w(reason.lemma)}, {reason.gloss}.
		</>
	) : reason.slip === "base" ? (
		<>{yours} is the dictionary form. The sentence needs an ending on it.</>
	) : reason.slip === "same-word" ? (
		<>
			{yours} is {w(reason.lemma)} with another ending.
		</>
	) : null;
	const example = other && !other.rule && !other.aspect && !other.reference ? other.example : undefined;
	const source = (chapter: string) => <span className="text-[13px] text-ink-3"> From the reference: {chapter}.</span>;
	const onlyOneAsks = Boolean(example?.asks) !== Boolean(reason.asks);
	const here = other ? (
		<>
			This one is {other.herePartOfSpeech ? `the ${other.herePartOfSpeech} ` : null}
			{w(reason.lemma)}, {other.hereMeans ?? reason.gloss}.{reason.asks && example && onlyOneAsks ? " Here it asks a question." : null}
		</>
	) : what ? null : (
		<>
			The word here is {w(reason.lemma)}, {reason.gloss}.
		</>
	);
	const need = reason.trigger ? (
		<>
			<span className="rounded-[5px] bg-well px-1.5 font-semibold text-teal-2" lang={code}>
				{reason.trigger}
			</span>{" "}
			decides the case{reason.form ? <>: {w(`${reason.form}`)}</> : null}.
		</>
	) : reason.form ? (
		<>The sentence needs the {w(reason.form)}.</>
	) : null;
	return (
		<div className={cn("lh-fade flex flex-col gap-1.5 text-[15px] leading-snug text-foreground", className)} data-testid="review-why">
			{what && <p>{what}</p>}
			{other?.rule && <p data-testid="review-why-rule">{other.rule}</p>}
			{other?.aspect && (
				<p data-testid="review-why-aspect">
					{w(other.aspect.imperfective)} is the imperfective and {w(other.aspect.perfective)} the perfective of one verb.{other.aspect.rule ? ` ${other.aspect.rule}` : null}
					{source(other.aspect.chapter)}
				</p>
			)}
			{other?.reference && (
				<p data-testid="review-why-reference">
					{other.reference.line}
					{source(other.reference.chapter)}
				</p>
			)}
			{other?.note && (
				<p data-testid="review-why-note">
					{noteSpans(other.note).map((part, i) => (part.word ? <b key={i} className="font-semibold" lang={code}>{part.text}</b> : <span key={i}>{part.text}</span>))}{" "}
					<span className="text-[13px] text-ink-3">AI note from the dictionary&apos;s sentences, not checked by a person.</span>
				</p>
			)}
			{other?.notePending && (
				<p data-testid="review-why-note-pending" className="text-ink-3">
					Comparing the two words in the dictionary&apos;s sentences…
				</p>
			)}
			{example && (
				<p data-testid="review-why-example">
					{example.asks && onlyOneAsks ? <>{yours} asks a question: </> : null}
					<i lang={code}>{example.text}</i> <span className="text-ink-3">{example.en}</span>
				</p>
			)}
			{here && <p>{here}</p>}
			{need && <p>{need}</p>}
		</div>
	);
}
