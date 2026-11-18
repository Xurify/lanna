"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskFrame } from "@/components/task-frame";
import { SpeakHeader } from "@/components/speak/speak-header";
import { SceneArt } from "@/components/speak/scene-art";
import { Stage } from "@/components/speak/scene-board";
import type { SpeakState } from "@/components/speak/speak-player";

const ROUND =
	"lanna-press flex size-10 items-center justify-center rounded-full bg-card text-ink-2 shadow-[0_0_0_1px_var(--q-line-2)] hover:bg-well hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40";

export function TutorFilmstrip({
	state,
	lang,
	error,
	sceneId,
	typed,
	onPick,
	onResume,
	onRetry,
}: {
	state: SpeakState | null;
	lang: { id: string; tag: string };
	error: string | null;
	sceneId: string | null;
	typed: boolean;
	onPick: (id: string, typed: boolean) => void;
	onResume: (id: string) => void;
	onRetry: () => void;
}) {
	const scenes = useMemo(() => state?.scenes ?? [], [state]);
	const first = state?.unfinished?.scene ?? sceneId ?? scenes[0]?.id ?? null;
	const [active, setActive] = useState(
		Math.max(
			0,
			scenes.findIndex((s) => s.id === first),
		),
	);
	const strip = useRef<HTMLDivElement>(null);

	const go = (index: number, smooth = true) => {
		const el = strip.current?.children[index] as HTMLElement | undefined;
		if (!el || !strip.current) return;
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		strip.current.scrollTo({
			left: el.offsetLeft - strip.current.offsetLeft,
			behavior: smooth && !still ? "smooth" : "auto",
		});
	};

	useEffect(() => {
		go(active, false);
	}, [scenes.length]);

	useEffect(() => {
		const root = strip.current;
		if (!root) return;
		const seen = new IntersectionObserver(
			(entries) => {
				for (const entry of entries)
					if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
			},
			{ root, threshold: 0.6 },
		);
		for (const child of Array.from(root.children)) seen.observe(child);
		return () => seen.disconnect();
	}, [scenes.length]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === "ArrowRight") go(Math.min(scenes.length - 1, active + 1));
			else if (e.key === "ArrowLeft") go(Math.max(0, active - 1));
			else return;
			e.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<TaskFrame>
			<div className="@container flex flex-1 flex-col overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-5 pt-[5vh] pb-12 @md:px-6">
					<SpeakHeader
						title="With a tutor"
						lead="Swipe through the scenes. The tutor plays the other person and answers you."
					/>
					{error && (
						<p className="mt-5 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}{" "}
							<button type="button" onClick={onRetry} className="underline">
								Try again
							</button>
						</p>
					)}
					{!state && !error && (
						<p className="mt-8 flex items-center gap-2 font-ui text-sm text-muted-foreground">
							<LoaderCircleIcon className="size-4 animate-spin" /> Loading the scenes…
						</p>
					)}
					{state && scenes.length > 0 && (
						<>
							<div className="mt-6 flex items-center justify-between gap-3">
								<p className="font-ui text-sm tabular-nums text-ink-3" aria-live="polite">
									Scene {active + 1} of {scenes.length}
								</p>
								<div className="flex gap-2">
									<button
										type="button"
										className={ROUND}
										onClick={() => go(active - 1)}
										disabled={active === 0}
										aria-label="Previous scene"
									>
										<ChevronLeftIcon className="size-5" />
									</button>
									<button
										type="button"
										className={ROUND}
										onClick={() => go(active + 1)}
										disabled={active === scenes.length - 1}
										aria-label="Next scene"
									>
										<ChevronRightIcon className="size-5" />
									</button>
								</div>
							</div>
							<div
								ref={strip}
								className="-mx-5 mt-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] @md:-mx-6 @md:scroll-px-6 @md:px-6"
								aria-label="Scenes"
							>
								{scenes.map((scene, i) => (
									<div
										key={scene.id}
										data-index={i}
										className={cn(
											"w-[88%] shrink-0 snap-start transition-opacity duration-300 @3xl:w-[92%]",
											i !== active && "opacity-45",
										)}
										aria-hidden={i !== active || undefined}
										inert={i !== active || undefined}
									>
										<Stage
											scene={scene}
											lang={lang}
											state={state}
											typed={typed}
											onPick={onPick}
											onResume={onResume}
											ref={null}
										/>
									</div>
								))}
							</div>
							<ol className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Jump to a scene">
								{scenes.map((scene, i) => (
									<li key={scene.id}>
										<button
											type="button"
											onClick={() => go(i)}
											aria-label={scene.title}
											aria-current={i === active || undefined}
											className={cn(
												"block w-16 rounded-md p-1 transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
												i === active
													? "bg-well text-foreground shadow-[0_0_0_1.5px_var(--color-teal-2)]"
													: "text-ink-3 hover:bg-well/60",
											)}
										>
											<SceneArt id={scene.id} text={`${scene.title} ${scene.blurb}`} />
										</button>
									</li>
								))}
							</ol>
						</>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}
