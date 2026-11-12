import { cn } from "@/lib/utils";
import type { MissReason, MissWord } from "@/src/core";

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
	const example = other && !other.rule ? other.example : undefined;
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
