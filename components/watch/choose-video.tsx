"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Poster } from "@/components/watch/thumb";
import { Known } from "@/components/watch/video-card";
import { coverageKind, formatClock, type VideoLibraryEntry, type WatchState } from "@/src/core";

/** The plan's video first, then the ones not watched yet, then the rest; newest first in each group. */
function inPickOrder(library: VideoLibraryEntry[], current: string | null): VideoLibraryEntry[] {
	const rest = [...library].reverse().filter((v) => v.id !== current);
	return [
		...library.filter((v) => v.id === current),
		...rest.filter((v) => v.watches === 0),
		...rest.filter((v) => v.watches > 0),
	];
}

/** Pick which of your videos to watch today: the pick starts and stays in today's plan. */
export function ChooseVideo({
	current,
	onClose,
	onChosen,
}: {
	/** The video the plan shows now. */
	current: string | null;
	onClose: () => void;
	/** The video is today's pick now; open it. */
	onChosen: (id: string) => void;
}) {
	const [library, setLibrary] = useState<VideoLibraryEntry[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [saving, setSaving] = useState<string | null>(null);

	useEffect(() => {
		void fetch(`/api/watch?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<WatchState>;
			})
			.then((w) => setLibrary(inPickOrder(w.library, current)))
			.catch(() => setFailed(true));
	}, [current]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			onClose();
		};
		document.addEventListener("keydown", onKey, true);
		return () => document.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	const choose = (id: string) => {
		if (id === current) return onChosen(id);
		setSaving(id);
		setFailed(false);
		void fetch("/api/watch", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "choose", videoId: id, tz: new Date().getTimezoneOffset() }),
		})
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				onChosen(id);
			})
			.catch(() => {
				setSaving(null);
				setFailed(true);
			});
	};

	return (
		<Dialog onClose={onClose}>
			<DialogPortal>
				<DialogOverlay>
					<DialogContent
						aria-labelledby="choose-video-title"
						data-testid="choose-video"
						showClose
						className="max-h-[85vh] w-[560px] max-w-[92vw] gap-0 p-0"
					>
						<header className="shrink-0 px-6 pt-5 pb-3">
							<h2 id="choose-video-title" className="text-[17px] font-semibold tracking-[-0.01em]">
								What to watch today
							</h2>
							<p className="mt-0.5 text-[13.5px] text-ink-3">Pick one to start it. It stays in today&apos;s plan.</p>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
							{failed && (
								<p className="mx-3 mb-2 rounded-lg bg-miss-soft px-3 py-2 text-[13.5px]" role="alert">
									That did not work. Check that Lanna is still running, then try again.
								</p>
							)}
							{!library && !failed && (
								<ul aria-hidden="true">
									{[0, 1, 2].map((i) => (
										<li key={i} className="mx-3 my-2 h-[54px] animate-pulse rounded-lg bg-well" />
									))}
								</ul>
							)}
							{library && library.length === 0 && (
								<p className="px-3 py-4 text-[14px] text-ink-2">
									There are no videos in your library yet. Add one in Media.
								</p>
							)}
							{library && library.length > 0 && (
								<ul data-testid="choose-video-list">
									{library.map((v) => {
										const kind = coverageKind(v);
										const isCurrent = v.id === current;
										return (
											<li key={v.id}>
												<button
													type="button"
													disabled={saving !== null}
													aria-current={isCurrent ? "true" : undefined}
													autoFocus={isCurrent}
													onClick={() => choose(v.id)}
													data-testid="choose-video-item"
													className={cn(
														"lanna-press flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-well disabled:opacity-60",
														isCurrent && "bg-teal-wash hover:bg-teal-wash",
													)}
												>
													<Poster id={v.id} watched={v.watches > 0} className="w-24 shrink-0 rounded-md" />
													<span className="min-w-0 flex-1">
														<span className="line-clamp-2 text-[14px] font-[550] text-foreground" title={v.title}>
															{v.title}
														</span>
														{isCurrent && (
															<span className="mt-0.5 block text-[12px] font-[550] text-teal-2">
																In today&apos;s plan
															</span>
														)}
														<span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
															<span className="q-num">{formatClock(v.durationSec)}</span>
															{" · "}
															{kind === "none" ? (
																"other-language captions"
															) : (
																<Known coverage={v.coverage} about={kind === "estimated"} />
															)}
															{v.watches > 0 ? ` · watched ${v.watches}×` : ""}
														</span>
													</span>
													{saving === v.id && <span className="shrink-0 text-[12px] text-ink-3">Opening…</span>}
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</div>
						<footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/50 px-6 py-3">
							<span className="text-[13px] text-ink-3">Want something new?</span>
							<Link href="/watch" className="q-btn sec" data-testid="choose-video-find">
								Find more in Media
							</Link>
						</footer>
					</DialogContent>
				</DialogOverlay>
			</DialogPortal>
		</Dialog>
	);
}
