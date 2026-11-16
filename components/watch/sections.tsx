"use client";
/**
 * Study sections on a prepared video's preview (E62): a model picks up to
 * three parts worth studying and the words in them; each word becomes a typed
 * gap in its real line (src/core/watch-sections.ts), drilled with the shared
 * GapDrill (retrieval first, graded cues, "I don't know" is a miss).
 */

import { useEffect, useMemo, useState } from "react";
import { LoaderCircleIcon, RepeatIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUIET, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { GapDrill, type GapOutcome } from "@/components/watch/gap-drill";
import {
	formatClock,
	sectionReps,
	type GapResult,
	type SectionsRecord,
	type StudySection,
	type VideoRecord,
} from "@/src/core";

export function StudySections({ video, canFind }: { video: VideoRecord; canFind: boolean }) {
	const [rec, setRec] = useState<SectionsRecord | null | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drilling, setDrilling] = useState<number | null>(null);

	useEffect(() => {
		let live = true;
		void fetch(`/api/watch/sections?id=${video.id}`)
			.then((r) => (r.ok ? r.json() : { sections: null }))
			.then((b: { sections: SectionsRecord | null }) => live && setRec(b.sections))
			.catch(() => live && setRec(null));
		return () => {
			live = false;
		};
	}, [video.id]);

	const find = async (force: boolean) => {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/watch/sections", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "find", videoId: video.id, force }),
			});
			const body = (await res.json()) as { sections?: SectionsRecord; message?: string };
			if (!res.ok || !body.sections) throw new Error(body.message ?? `HTTP ${res.status}`);
			setRec(body.sections);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	if (rec === undefined) return null;
	const section = drilling !== null ? rec?.sections[drilling] : undefined;
	return (
		<section className="mt-10" data-testid="watch-sections">
			<h2 className="font-ui text-lg font-[600] text-foreground">Study sections</h2>
			{section && drilling !== null ? (
				<SectionDrill
					key={drilling}
					video={video}
					section={section}
					index={drilling}
					onBack={() => setDrilling(null)}
				/>
			) : (
				<>
					<p className="mt-1 font-prose text-sm text-muted-foreground">
						{rec
							? "The parts worth studying, picked by a model. Each word is a gap in the line you heard: type it."
							: "A model reads the lines and picks up to three parts worth studying, and the words in them. You then fill those words into the real lines. One cheap request, kept for this video."}
					</p>
					{rec && (
						<ol className="mt-4 flex flex-col gap-2" data-testid="watch-sections-list">
							{rec.sections.map((s, i) => (
								<li
									key={`${s.from}-${s.to}`}
									className="q-card flex items-center gap-4 px-4 py-3.5"
									data-testid="watch-section"
								>
									<span className="min-w-0 flex-1">
										<span className="block font-ui text-[15px] font-[600] text-foreground">{s.title}</span>
										{s.why && <span className="mt-0.5 block font-prose text-sm text-ink-2">{s.why}</span>}
										<span className="mt-1 block font-prose text-[13px] text-ink-3">
											{span(video, s)} · lines {s.from + 1} to {s.to + 1} ·{" "}
											{s.focus.length === 1 ? "1 word" : `${s.focus.length} words`}
										</span>
									</span>
									<button
										type="button"
										onClick={() => setDrilling(i)}
										className={cn(SECONDARY, "h-9 shrink-0")}
										data-testid="watch-section-practice"
									>
										Practice
									</button>
								</li>
							))}
						</ol>
					)}
					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
						{rec ? (
							<button
								type="button"
								disabled={busy || !canFind}
								onClick={() => void find(true)}
								className={cn(QUIET, SMALL)}
								data-testid="watch-sections-again"
							>
								{busy ? (
									<LoaderCircleIcon className="size-4 animate-spin" />
								) : (
									<RepeatIcon className="size-4" strokeWidth={1.6} />
								)}
								Find new sections
							</button>
						) : (
							<button
								type="button"
								disabled={busy || !canFind}
								onClick={() => void find(false)}
								className={cn(SECONDARY, "h-10")}
								data-testid="watch-sections-find"
							>
								{busy && <LoaderCircleIcon className="size-4 animate-spin" />}
								{busy ? "Reading the lines…" : "Find sections"}
							</button>
						)}
						{!canFind && (
							<span className="font-prose text-sm text-muted-foreground">
								Needs an AI model: pick one in Settings → AI models.
							</span>
						)}
						{rec && rec.linesShown < video.segments.length && (
							<span className="font-prose text-sm text-muted-foreground">
								The model saw the first {rec.linesShown} of {video.segments.length} lines.
							</span>
						)}
					</div>
					{error && (
						<p className="mt-2 font-prose text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</>
			)}
		</section>
	);
}

function span(video: VideoRecord, s: StudySection): string {
	const at = (i: number) => video.segments.find((x) => x.i === i);
	const a = at(s.from);
	const b = at(s.to);
	return a && b ? `${formatClock(a.start)} to ${formatClock(b.end)}` : "";
}

function SectionDrill({
	video,
	section,
	index,
	onBack,
}: {
	video: VideoRecord;
	section: StudySection;
	index: number;
	onBack: () => void;
}) {
	const reps = useMemo(() => sectionReps(video, section), [video, section]);
	const save = async (results: GapResult[], activeMs: number): Promise<GapOutcome> => {
		const res = await fetch("/api/watch/sections", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				action: "finish",
				videoId: video.id,
				section: index,
				results,
				activeMs,
				tz: new Date().getTimezoneOffset(),
			}),
		});
		const body = (await res.json()) as GapOutcome & { message?: string };
		if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
		return body;
	};
	return (
		<GapDrill
			title={section.title}
			lang={video.lang}
			reps={reps}
			onSave={save}
			onBack={onBack}
			backLabel="Back to sections"
			testid="watch-section"
		/>
	);
}
