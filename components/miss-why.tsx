import { cn } from "@/lib/utils";
import type { MissReason, MissWord } from "@/src/core";

function OtherWord({ other, given, yours, w }: { other: MissWord; given: string; yours: React.ReactNode; w: (text: string) => React.ReactNode }) {
	const spelledAsLemma = other.isLemma && given.trim().toLowerCase() === other.lemma.toLowerCase();
	const named = spelledAsLemma ? null : other.isLemma ? <>is {w(other.lemma)}</> : <>is a form of {w(other.lemma)}</>;
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
	const here = other ? (
		<>
			This one is {w(reason.lemma)}, {reason.gloss}.
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
			{other?.example && (
				<p data-testid="review-why-example">
					<i lang={code}>{other.example.text}</i> <span className="text-ink-3">{other.example.en}</span>
				</p>
			)}
			{here && <p>{here}</p>}
			{need && <p>{need}</p>}
		</div>
	);
}
