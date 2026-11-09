"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MaximizeIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fitGraphView, fitZoomFor, zoomedGraphView, type Viewport } from "@/components/pan-zoom";
import { CHAT_PAD, GLOW_PAD, renderPlan, type PlanDiagramSvg } from "@/components/plan-diagram";
import type { PlanBlockData, PlanNodeStatus, PlanTree } from "@/src/core";
import { derivedNodeStatus, derivePlanStatuses } from "@/src/core";
import { Hint } from "@/components/ui/hint";

/**
 * PLAN BLOCKS — the plan lives in the chat. Persisted `data-plan-block` parts
 * render as a diagram in the transcript flow; the live plan opens in the
 * session-scoped popup; the dock band's marginalia shows it beside a question.
 *
 * Layout and drawing come from Pele (components/plan-diagram.ts). Statuses
 * reach the drawing as classes, and the colors live in globals.css (.plan-wrap).
 */

/** How the diagram fills its container:
 *  - column: full width of the chat column, never past its natural size
 *  - natural: its natural size, scaled by the popup's zoom transform
 *  - fill: meet-fitted into a box of fixed height (the marginalia flank) */
export type PlanSizing = "column" | "natural" | "fill";

export function PlanSvg({
	diagram,
	sizing,
	monochrome = false,
}: {
	diagram: PlanDiagramSvg;
	sizing: PlanSizing;
	monochrome?: boolean;
}) {
	const style =
		sizing === "column"
			? { maxWidth: `${diagram.width}px` }
			: sizing === "natural"
				? { width: `${diagram.width}px` }
				: undefined;
	return (
		<div
			role="img"
			aria-label="Plan diagram"
			data-testid="plan-diagram"
			className={cn(
				"plan-wrap",
				sizing === "column" && "mx-auto w-full",
				sizing === "natural" && "shrink-0",
				sizing === "fill" && "plan-fill h-full w-full",
				monochrome && "plan-mono",
			)}
			style={style}
			dangerouslySetInnerHTML={{ __html: diagram.svg }}
		/>
	);
}

// ─── The transcript block ─────────────────────────────────────────────────────

/**
 * A persisted plan-block part, rendered as carried (snapshot statuses, never
 * re-derived): borderless and column-filling, it opens the live plan popup.
 * The in-chat diagram is monochrome, so no status shows in the transcript.
 */
export function PlanBlock({ data, onOpen }: { data: PlanBlockData; onOpen: () => void }) {
	const statusMap = useMemo(() => new Map(data.nodes.map((n) => [n.id, n.status] as const)), [data]);
	const statusOf = useMemo(() => (id: string): PlanNodeStatus => statusMap.get(id) ?? "upcoming", [statusMap]);
	const diagram = useMemo(
		() => renderPlan(data.nodes, data.edges, statusOf, { monochrome: true, pad: CHAT_PAD }),
		[data, statusOf],
	);
	if (!diagram) return null;
	return (
		<Hint label="Open the full plan" side="bottom">
			<button
				type="button"
				data-testid="plan-block-full"
				aria-label="Open the full plan"
				onClick={onOpen}
				className="block w-full text-left"
			>
				<PlanSvg diagram={diagram} sizing="column" monochrome />
			</button>
		</Hint>
	);
}

// ─── The live plan popup ──────────────────────────────────────────────────────

/** Minimal structural message slice (same trick as phases.ts). */
export interface PopupMessage {
	parts: ReadonlyArray<{ type: string; state?: string; input?: unknown; output?: unknown }>;
}

/** The latest plan tree in the transcript (latest tool-plan_ output). */
export function latestTree(messages: readonly PopupMessage[]): PlanTree | null {
	for (let m = messages.length - 1; m >= 0; m--) {
		const parts = messages[m]?.parts;
		if (!parts) continue;
		for (let p = parts.length - 1; p >= 0; p--) {
			const part = parts[p]!;
			if (!part.type.startsWith("tool-plan_") || part.state !== "output-available") continue;
			const output = part.output as { tree?: PlanTree } | undefined;
			if (output?.tree && Array.isArray(output.tree.nodes)) return output.tree;
		}
	}
	return null;
}

/**
 * The full plan, live: latest tree + statuses derived at click time. Esc,
 * backdrop click, or the X close it; drag pans, wheel zooms to the cursor,
 * the zoom floor is the fit (panning locks at it — nothing to move).
 *
 * SESSION-SCOPED: it mounts ABSOLUTE inside the chat page's session-area div
 * (chat.tsx) — below the drag bar, right of the sidebar — so the top bar stays
 * draggable and the X can never land in drag territory. Surface 80% + blur:
 * the transcript ghosts through while the focus owns the session area.
 */
export function PlanPopup({ messages, onClose }: { messages: readonly PopupMessage[]; onClose: () => void }) {
	const tree = useMemo(() => latestTree(messages), [messages]);
	const statuses = useMemo(
		() => (tree ? derivePlanStatuses(tree, messages as Parameters<typeof derivePlanStatuses>[1]) : null),
		[tree, messages],
	);
	const diagram = useMemo(() => {
		if (!tree) return null;
		const statusOf = (id: string): PlanNodeStatus => (statuses ? derivedNodeStatus(statuses, id) : "upcoming");
		return renderPlan(tree.nodes, tree.edges, statusOf, { monochrome: false, pad: GLOW_PAD });
	}, [tree, statuses]);

	// Esc closes — claimed at the DOCUMENT level (THE ONE-ESC LAW, owner
	// keyboard round 2026-10-06): a surfaced layer's Esc is exactly one
	// action. A window listener here could never stop the dictation cancel
	// that also listens on the window — same-node listeners all fire.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	// ── pan/zoom viewport (fit floor = the default) ──
	const viewportRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ w: 0, h: 0 });
	useEffect(() => {
		const el = viewportRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// The diagram already includes the glow's padding, so its drawn size is the fit box.
	const box = useMemo(
		() => (diagram ? { w: diagram.width, h: diagram.height } : { w: 0, h: 0 }),
		[diagram],
	);
	const fitZoom = useMemo(() => fitZoomFor(box, size), [box, size]);

	const [view, setView] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
	const userAdjustedRef = useRef(false);
	const atFloor = view.zoom <= fitZoom + 1e-9;
	// The transition stays off until the FIRST fit has been applied — the
	// popup paints at the fit directly instead of flying in from zoom 1.
	const [settled, setSettled] = useState(false);

	useEffect(() => {
		if (atFloor) userAdjustedRef.current = false;
	}, [atFloor]);
	useEffect(() => {
		if (userAdjustedRef.current || !size.w || !size.h) return;
		setView(fitGraphView(box, size, fitZoom));
		// Enable the transition only AFTER the fit has painted, so the browser
		// does not animate from the initial top-left zoom:1 state.
		const raf = requestAnimationFrame(() => setSettled(true));
		return () => cancelAnimationFrame(raf);
	}, [fitZoom, size, box]);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
			const factor = Math.exp(-dy * 0.0015);
			const rect = el.getBoundingClientRect();
			setView((v) =>
				zoomedGraphView(v, factor, fitZoom, { x: e.clientX - rect.left, y: e.clientY - rect.top }, box, size),
			);
			userAdjustedRef.current = true;
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [fitZoom, box, size]);

	// Smooth zoom: the transform eases between states. Panning is per-frame —
	// the transition is off while dragging or it rubber-bands.
	const [panning, setPanning] = useState(false);
	const dragRef = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
	const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement).closest("button")) return;
		if (atFloor) return;
		dragRef.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false };
		setPanning(true);
		e.currentTarget.classList.add("cursor-grabbing");
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = dragRef.current;
		if (!d) return;
		d.moved = true;
		setView((v) =>
			v.zoom <= fitZoom + 1e-9 ? v : { ...v, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) },
		);
	};
	const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = dragRef.current;
		if (d) {
			dragRef.current = null;
			if (d.moved) userAdjustedRef.current = true;
		}
		setPanning(false);
		e.currentTarget.classList.remove("cursor-grabbing");
	};
	const stepZoom = (factor: number) => {
		userAdjustedRef.current = true;
		setView((v) => zoomedGraphView(v, factor, fitZoom, { x: size.w / 2, y: size.h / 2 }, box, size));
	};
	const fitView = () => {
		userAdjustedRef.current = false;
		if (!size.w || !size.h) return;
		setView(fitGraphView(box, size, fitZoom));
	};

	return (
		<div
			data-testid="plan-popup"
			// SESSION-SCOPED (absolute, not fixed): see the component doc above.
			className="absolute inset-0 z-40 flex flex-col bg-background p-4"
			role="dialog"
			aria-modal="true"
			aria-label="The full plan"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="mb-2 flex items-center gap-2">
				<span className="text-sm font-medium">The plan</span>
				<span className="text-xs text-muted-foreground">updates as you answer the checks</span>
				<Hint label="Close" binding="escape" side="left">
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						data-testid="plan-popup-close"
						className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<XIcon className="size-4" />
					</button>
				</Hint>
			</div>
			<div
				ref={viewportRef}
				className={cn(
					"relative min-h-0 flex-1 touch-none overflow-hidden rounded-xl border select-none",
					atFloor ? "cursor-default" : "cursor-grab",
				)}
				onPointerDown={startDrag}
				onPointerMove={moveDrag}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
			>
				{diagram ? (
					<>
						<div
							className="absolute top-0 left-0 origin-top-left"
							style={{
								transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
								// Hidden until the first fit has APPLIED — the fit runs in an
								// effect (after paint), so the diagram never flashes at zoom 1.
								opacity: settled ? 1 : 0,
								transition:
									panning || !settled
										? "none"
										: "transform 180ms ease-out, opacity 160ms ease-out",
							}}
						>
							<PlanSvg diagram={diagram} sizing="natural" />
						</div>
						<div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-2">
							<span className="text-xs text-muted-foreground">Drag to pan · scroll to zoom</span>
							<div className="flex gap-1">
								<Hint label="Zoom out" side="bottom">
									<button
										type="button"
										aria-label="Zoom out"
										onClick={() => stepZoom(1 / 1.25)}
										className="pointer-events-auto flex size-7 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									>
										<MinusIcon className="size-3.5" />
									</button>
								</Hint>
								<Hint label="Fit plan to screen" side="bottom">
									<button
										type="button"
										aria-label="Fit plan to screen"
										onClick={fitView}
										data-testid="plan-popup-fit"
										className="pointer-events-auto flex size-7 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									>
										<MaximizeIcon className="size-3.5" />
									</button>
								</Hint>
								<Hint label="Zoom in" side="bottom">
									<button
										type="button"
										aria-label="Zoom in"
										onClick={() => stepZoom(1.25)}
										className="pointer-events-auto flex size-7 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									>
										<PlusIcon className="size-3.5" />
									</button>
								</Hint>
							</div>
						</div>
					</>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						No plan in this chat yet.
					</div>
				)}
			</div>
		</div>
	);
}
