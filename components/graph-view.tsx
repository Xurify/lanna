"use client";

/**
 * The home knowledge-graph view. Drawing is done by GraphCanvasRenderer
 * (./graph-canvas.ts): one Canvas 2D with a single rAF loop that draws only
 * when something changed, so idle CPU is zero. This component fetches and
 * lays out the snapshot, resolves theme colors to hex, applies the search
 * filter, and feeds the renderer data, settings, and visibility.
 *
 * Settings apply by redrawing: no rebuild, no re-layout, and the camera
 * never moves. labelZoom keeps the camera-ratio convention (1 = fit zoom,
 * smaller = zoomed in).
 */

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NotesImportErrors, useNotesImport } from "@/components/notes-import.tsx";
import Link from "next/link";
import { FileTextIcon, ListTreeIcon, Loader2Icon, SearchIcon, SettingsIcon, UploadIcon, WaypointsIcon, XIcon } from "lucide-react";
import { incrementalLayout, propositionSessionHref, type GraphCostSummary, type GraphNode, type GraphSnapshot } from "@/src/core";
import { planCostLabel } from "@/components/usage-format";
import { GraphCanvasRenderer, type GraphRenderSettings } from "./graph-canvas.ts";
import { usePopoverDismiss } from "@/components/popover-dismiss";
import { useActivity } from "@/components/activity-dock";
import { useServerEvent, useServerResync } from "@/components/server-events";
import { MenuShell } from "@/components/menu-shell.tsx";
import { DeleteNodeDialog } from "@/components/delete-node-dialog.tsx";
import { ChainTableOverlay } from "@/components/chain-table.tsx";
import { Hint } from "@/components/ui/hint";
import { ARROW_LENGTH_LADDER, CHARGE_RANGE, CLUSTER_LABEL_SIZE_LADDER, CLUSTER_PULL_RANGE, DEPTH_BASE_RADIUS_RANGE, DEPTH_SPACING_RANGE, DEPTH_STRENGTH_RANGE, DEFAULT_RENDER_SETTINGS, EDGE_WIDTH_LADDER, GRAVITY_RANGE, LABEL_SIZE_LADDER, LABEL_ZOOM_LADDER, LINK_DISTANCE_RANGE, LINK_STRENGTH_RANGE, NODE_SIZE_LADDER, REGION_BITMAP_OPTIONS, REGION_BLUR_LADDER, fromLadderPosition, toLadderPosition, REGION_DILATION_LADDER, REGION_EDGE_ALPHA_LADDER, VELOCITY_DECAY_RANGE, fromOffSliderPosition, fromSliderPosition, labelZoomDisplay, sanitizeRenderSettings, toOffSliderPosition, toSliderPosition } from "@/src/core";

const NODE_COLOR_TOKEN = "--primary";

/** Per-device camera (renderer d3 transform {k, x, y}), kept out of server settings. */
const CAMERA_STORAGE_KEY = "lh.graph.camera.v1";

// ---- Render settings (the settings-panel controls) ------------------------

type RenderSettings = GraphRenderSettings;

/** Search filter: an empty query matches all; otherwise name or statement, case-insensitive. */
export function isNodeVisible(node: Pick<GraphNode, "name" | "statement">, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return node.name.toLowerCase().includes(q) || node.statement.toLowerCase().includes(q);
}

/**
 * Patches a session title in place. The snapshot object must keep its
 * identity: a new one would re-run the [snapshot]-keyed data feed, rebuild
 * geometry, and rewind a pending drag. Exported for tests.
 */
export function renameSessionsPatch(snapshot: Pick<GraphSnapshot, "sessions">, id: string, title: string): void {
	snapshot.sessions[id] = title;
}

/**
 * Places nodes missing from the ledger on a deterministic ring around the
 * known positions' centroid, so they do not collapse to the origin. Writes
 * into the provided map and returns it.
 */
export function seedMissingNodePositions(
	nodes: readonly { id: string }[],
	positions: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
	if (positions.size === 0 || nodes.every((n) => positions.has(n.id))) return positions;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of positions.values()) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const radius = Math.max(maxX - minX, maxY - minY, 40) * 0.7 + 20;
	const missing = nodes.filter((n) => !positions.has(n.id));
	missing.forEach((n, i) => {
		let h = 0x811c9dc5;
		for (let c = 0; c < n.id.length; c++) {
			h ^= n.id.charCodeAt(c);
			h = (h * 0x01000193) >>> 0;
		}
		const angle = ((h / 0xffffffff) * 2 * Math.PI + i * 2.39996323) % (2 * Math.PI);
		positions.set(n.id, {
			x: cx + Math.cos(angle) * radius,
			y: cy + Math.sin(angle) * radius,
		});
	});
	return positions;
}

// ---- Color helpers (canvas wants hex, not oklch) ---------------------------

/** Resolve a CSS variable (oklch in this app) to #rrggbb via the canvas. */
function cssColorToHex(css: string): string {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) return "#888888";
	ctx.fillStyle = css;
	ctx.fillRect(0, 0, 1, 1);
	const { data } = ctx.getImageData(0, 0, 1, 1);
	return `#${[data[0]!, data[1]!, data[2]!]
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("")}`;
}

function tokenHex(cssVar: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
	return value ? cssColorToHex(value) : "#888888";
}

// ---- Component ------------------------------------------------------------

interface Selection {
	node: GraphNode;
	/** Chat ids (deep-linkable sessions) and notes-source ids ("src_…"). */
	sourceIds: string[];
	/** Node position in container px at click time; camera moves dismiss the card. */
	anchor: { x: number; y: number };
}

/** Compact size display for the log sliders: "2", "1.6", "0.75". */
function sizeDisplay(v: number): string {
	return `${v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100}`;
}

function SettingSlider({
	label,
	min,
	max,
	step,
	value,
	display,
	onChange,
	disabled,
}: {
	label: string;
	min: number;
	max: number;
	step: number;
	value: number;
	/** Value display override (e.g. "1.5×" for zoom) — defaults to the raw number. */
	display?: string;
	onChange: (v: number) => void;
	/** Dims and locks the slider while its parent toggle or mode is off. */
	disabled?: boolean;
}) {
	return (
		<label className={`flex flex-col gap-1${disabled ? " opacity-40" : ""}`}>
			<span className="flex items-center justify-between text-[11px] text-muted-foreground">
				{label}
				<span className="tabular-nums">{display ?? value}</span>
			</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(Number(e.target.value))}
				className="h-1.5 w-full accent-primary"
			/>
		</label>
	);
}

/** Compact token display: 45231 → "45.2k"; absent → "—". */
function fmtTokens(n: number | undefined): string {
	if (n === undefined) return "—";
	if (n < 1000) return String(Math.round(n));
	if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
	return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Relative time for run rows: "now", "12m", "3h", "2d". */
function timeAgo(startedAt: number): string {
	const mins = Math.round((Date.now() - startedAt) / 60_000);
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.round(hours / 24)}d`;
}

/** Run and stage costs at three decimals; headline totals use two. */
function fmtRunCost(dollars: number | null, providers: readonly string[] = []): string {
	return planCostLabel(dollars, providers, (value) => `$${value.toFixed(3)}`);
}
function graphProviders(value: { subscriptionRuns?: number; subscriptionProviders?: string[] }): string[] {
	return value.subscriptionProviders ?? ((value.subscriptionRuns ?? 0) > 0 ? ["ChatGPT"] : []);
}
/** The seeded curriculum's sources are named "Slovak curriculum: cases";
 *  on the map the language is already known, so the label is "Cases". */
function regionName(label: string | null): string | null {
	if (label == null) return label;
	const short = label.replace(/^\p{L}+ curriculum: /u, "");
	return short.charAt(0).toLocaleUpperCase() + short.slice(1);
}

function graphUsageLabel(costs: Pick<GraphCostSummary, "stages">): string {
	const stages = [costs.stages.extraction, costs.stages.audit];
	const providers = [...new Set(stages.flatMap(graphProviders))];
	const priced = stages.some((stage) => stage.runs - stage.unpricedRuns - (stage.subscriptionRuns ?? 0) > 0);
	const dollars = displayCostTotals(costs).totalDollars;
	return planCostLabel(priced ? dollars : null, providers, (value) => `$${value.toFixed(2)}`);
}

/**
 * Cost totals the UI displays: extraction and audit only. The pill and the
 * panel both read this, never GraphCostSummary.totalDollars.
 */
export function displayCostTotals(costs: Pick<GraphCostSummary, "stages">): {
	totalDollars: number;
	unpricedRuns: number;
} {
	return {
		totalDollars: costs.stages.extraction.dollars + costs.stages.audit.dollars,
		unpricedRuns: costs.stages.extraction.unpricedRuns + costs.stages.audit.unpricedRuns,
	};
}

/**
 * Bare cumulative-dollars number that toggles the breakdown panel. Exported
 * for the chains home, where graph rendering is off.
 */
export function GraphCostControl({ costs }: { costs: GraphCostSummary }) {
	const [open, setOpen] = useState(false);
	// The root wraps button and panel, so an outside click closes without eating the toggle.
	const rootRef = useRef<HTMLDivElement>(null);
	usePopoverDismiss(rootRef, open, () => setOpen(false));
	return (
		<div ref={rootRef} className="relative">
			<Hint
				label="Graph costs — click for details"
				side="bottom"
			>
				<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={`rounded-lg px-2 py-1 text-xs tabular-nums transition-colors hover:bg-accent ${
					open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
				}`}
			>
				{graphUsageLabel(costs)}
			</button>
			</Hint>
			{open && (
				<div className="absolute right-0 top-full mt-2 max-h-[60vh] overflow-y-auto">
					<GraphCostPanel costs={costs} />
				</div>
			)}
		</div>
	);
}

/**
 * Expanded cost panel: stage totals (dollars headline, tokens secondary) and
 * the recent runs. Presentational: the fold runs server-side, and dollars are
 * inferred at read time.
 */
function GraphCostPanel({ costs }: { costs: GraphCostSummary }) {
	const stageRows: [string, GraphCostSummary["stages"]["extraction"]][] = [
		["Extraction", costs.stages.extraction],
		["Audit", costs.stages.audit],
	];
	const { unpricedRuns } = displayCostTotals(costs);
	return (
		<div className="w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-card p-3 text-xs shadow-raise-hi">
			<div className="mb-2 flex items-baseline justify-between">
				<span className="text-xs font-medium text-muted-foreground">
					Graph costs
				</span>
				<span className="text-foreground tabular-nums">
					{graphUsageLabel(costs)}
					{unpricedRuns > 0 && (
						<span className="text-muted-foreground"> · {unpricedRuns} unpriced</span>
					)}
				</span>
			</div>
			<div className="flex flex-col gap-1">
				{stageRows.map(([label, stage]) => (
					<div key={label} className="flex items-baseline justify-between gap-2 text-[11px]">
						<span className="shrink-0 text-muted-foreground">{label}</span>
						<span className="min-w-0 text-right tabular-nums">
							{fmtRunCost(stage.runs - stage.unpricedRuns - (stage.subscriptionRuns ?? 0) <= 0 ? null : stage.dollars, graphProviders(stage))}
							{stage.unpricedRuns > 0 && (stage.runs - stage.unpricedRuns - (stage.subscriptionRuns ?? 0) > 0 || (stage.subscriptionRuns ?? 0) > 0) && (
								<span className="text-muted-foreground"> +{stage.unpricedRuns} unpriced</span>
							)}
							<span className="text-muted-foreground">
								{" "}
								· {fmtTokens(stage.tokens.inputTokens)} in / {fmtTokens(stage.tokens.outputTokens)} out
							</span>
						</span>
					</div>
				))}
			</div>
			<div className="mt-2 flex flex-col gap-0.5 border-t pt-2">
				{costs.runs.map((run) => (
						<div key={run.startedAt} className="flex items-baseline justify-between gap-2 text-[11px]">
							<span className="min-w-0 flex-1 truncate text-muted-foreground">
								<span className="text-foreground/70">{timeAgo(run.startedAt)}</span>{" "}
								{run.title}
								{run.merged && (
									<span className="text-muted-foreground">
										{" "}
										+{run.merged.nodes}n
									</span>
								)}
							</span>
							<span className="shrink-0 tabular-nums">{fmtRunCost(run.dollars, graphProviders(run))}{run.dollars === null && run.subscriptionRuns === 1 ? " +1 unpriced" : ""}</span>
						</div>
					))}
			</div>
		</div>
	);
}

/** Settings gear and its collapsible panel, which drops below the button. */
function GraphSettingsControl({
	settings,
	changeSettings,
}: {
	settings: GraphRenderSettings;
	changeSettings: (update: (cur: RenderSettings) => RenderSettings) => void;
}) {
	const [open, setOpen] = useState(false);
	// The root wraps button and panel, so an outside click closes without eating the toggle.
	const rootRef = useRef<HTMLDivElement>(null);
	usePopoverDismiss(rootRef, open, () => setOpen(false));
	const regionTuning = settings.regions;
	const physicsTuning = settings.physics;
	return (
		<div ref={rootRef} className="relative">
			<Hint
				label="Graph display settings"
				side="bottom"
			>
				<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={`flex size-9 items-center justify-center rounded-xl bg-card shadow-raise-hi transition-colors hover:bg-accent ${
					open ? "text-foreground" : "text-muted-foreground hover:text-foreground"
				}`}
			>
				<SettingsIcon className="size-4" />
			</button>
			</Hint>
			{open && (
				// Viewport-capped and scrollable, so the panel never stretches the page.
				<div className="absolute right-0 top-full mt-2 flex max-h-[60vh] w-72 flex-col rounded-xl bg-card p-2.5 shadow-raise-hi">
					<div className="flex flex-col gap-2 overflow-y-auto pr-2.5">
							{/* Ladder-mapped 0-100 sliders, step 10; defaults sit at 50. */}
							<SettingSlider
								label="Node size"
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.nodeSize, NODE_SIZE_LADDER)}
								display={sizeDisplay(settings.nodeSize)}
								onChange={(p) =>
									changeSettings((cur) => ({ ...cur, nodeSize: fromLadderPosition(p, NODE_SIZE_LADDER) }))}
							/>
							<SettingSlider
								label="Edge width"
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.edgeWidth, EDGE_WIDTH_LADDER)}
								display={sizeDisplay(settings.edgeWidth)}
								onChange={(p) =>
									changeSettings((cur) => ({ ...cur, edgeWidth: fromLadderPosition(p, EDGE_WIDTH_LADDER) }))}
							/>
							<SettingSlider
								label="Arrowhead size"
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.arrowLength, ARROW_LENGTH_LADDER)}
								display={sizeDisplay(settings.arrowLength)}
								onChange={(p) =>
									changeSettings((cur) => ({ ...cur, arrowLength: fromLadderPosition(p, ARROW_LENGTH_LADDER) }))}
							/>
							<SettingSlider
								label="Label size"
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.labelSize, LABEL_SIZE_LADDER)}
								display={sizeDisplay(settings.labelSize)}
								onChange={(p) =>
									changeSettings((cur) => ({ ...cur, labelSize: fromLadderPosition(p, LABEL_SIZE_LADDER) }))}
							/>
							{/* Displayed as a ratio to the 0.5 default, so "1×" sits at center. */}
							<SettingSlider
								label="Labels until zoom"
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.labelZoom, LABEL_ZOOM_LADDER)}
								display={labelZoomDisplay(settings.labelZoom)}
								onChange={(p) =>
									changeSettings((cur) => ({ ...cur, labelZoom: fromLadderPosition(p, LABEL_ZOOM_LADDER) }))}
							/>
							{/* Blurred cluster tints. The enable switch is a compute switch: off skips the whole build, not just the paint. */}
						<div className="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								Regions
							</span>
							<label className="flex cursor-pointer items-center justify-between text-[11px] text-muted-foreground">
								<span>Background colors</span>
								<input
									type="checkbox"
									checked={settings.regions.enabled}
									onChange={(e) =>
										changeSettings((cur) => ({
											...cur,
											regions: { ...cur.regions, enabled: e.target.checked },
										}))}
										className="accent-primary"
								/>
							</label>
							<SettingSlider
								label="Dilation"
								disabled={!regionTuning.enabled}
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(regionTuning.dilation, REGION_DILATION_LADDER)}
								display={sizeDisplay(regionTuning.dilation)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										regions: { ...cur.regions, dilation: fromLadderPosition(p, REGION_DILATION_LADDER) },
									}))}
							/>
							<SettingSlider
								label="Blur"
								disabled={!regionTuning.enabled}
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(regionTuning.blur, REGION_BLUR_LADDER)}
								display={sizeDisplay(regionTuning.blur)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										regions: { ...cur.regions, blur: fromLadderPosition(p, REGION_BLUR_LADDER) },
									}))
								}
							/>
							<SettingSlider
								label="Edge alpha"
								disabled={!regionTuning.enabled}
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(regionTuning.edgeAlpha, REGION_EDGE_ALPHA_LADDER)}
								display={sizeDisplay(regionTuning.edgeAlpha)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										regions: { ...cur.regions, edgeAlpha: fromLadderPosition(p, REGION_EDGE_ALPHA_LADDER) },
									}))}
							/>
							<label
								className={`flex items-center justify-between gap-2 text-[11px] text-muted-foreground${!regionTuning.enabled ? " opacity-40" : ""}`}
							>
								<span>Bitmap resolution</span>
								<select
									disabled={!regionTuning.enabled}
									className="rounded-md border bg-background px-1.5 py-0.5 text-xs tabular-nums text-foreground"
									value={regionTuning.bitmap}
									onChange={(e) =>
										changeSettings((cur) => ({
											...cur,
											regions: { ...cur.regions, bitmap: Number(e.target.value) },
										}))
									}
								>
									{REGION_BITMAP_OPTIONS.map((o) => (
										<option key={o} value={o}>
											{o}
										</option>
									))}
								</select>
							</label>
							{/* Own toggle, independent of Background colors. Size is screen px, constant at any zoom. */}
							<label className="flex cursor-pointer items-center justify-between text-[11px] text-muted-foreground">
								<span>Cluster labels</span>
								<input
									type="checkbox"
									checked={settings.clusterLabels}
									onChange={(e) => changeSettings((cur) => ({ ...cur, clusterLabels: e.target.checked }))}
									className="accent-primary"
								/>
							</label>
							<SettingSlider
								label="Cluster label size"
								disabled={!settings.clusterLabels}
								min={0}
								max={100}
								step={10}
								value={toLadderPosition(settings.clusterLabelSize, CLUSTER_LABEL_SIZE_LADDER)}
								display={sizeDisplay(settings.clusterLabelSize)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										clusterLabelSize: fromLadderPosition(p, CLUSTER_LABEL_SIZE_LADDER),
									}))}
							/>
						</div>
						{/* Live sim forces, the same engine the server settle runs. Each change rebuilds the sim in place; pins survive. Repulsion shows as the negative it is. */}
						<div className="mt-1.5 flex flex-col gap-1.5 border-t pt-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								Physics
							</span>
							<SettingSlider
								label="Node repulsion"
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(-physicsTuning.chargeStrength, -CHARGE_RANGE.max, -CHARGE_RANGE.min)}
								display={`-${Math.round(-physicsTuning.chargeStrength)}`}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, chargeStrength: -fromSliderPosition(p, -CHARGE_RANGE.max, -CHARGE_RANGE.min) },
									}))}
							/>
							<SettingSlider
								label="Edge attraction"
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.linkStrength, LINK_STRENGTH_RANGE.min, LINK_STRENGTH_RANGE.max)}
								display={sizeDisplay(physicsTuning.linkStrength)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, linkStrength: fromSliderPosition(p, LINK_STRENGTH_RANGE.min, LINK_STRENGTH_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Edge length"
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.linkDistance, LINK_DISTANCE_RANGE.min, LINK_DISTANCE_RANGE.max)}
								display={sizeDisplay(physicsTuning.linkDistance)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, linkDistance: fromSliderPosition(p, LINK_DISTANCE_RANGE.min, LINK_DISTANCE_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Central pull"
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.gravity, GRAVITY_RANGE.min, GRAVITY_RANGE.max)}
								display={sizeDisplay(physicsTuning.gravity)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, gravity: fromSliderPosition(p, GRAVITY_RANGE.min, GRAVITY_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Cluster pull"
								min={0}
								max={100}
								step={5}
								value={toOffSliderPosition(physicsTuning.clusterPull, CLUSTER_PULL_RANGE.min, CLUSTER_PULL_RANGE.max)}
								display={physicsTuning.clusterPull <= 0 ? "off" : sizeDisplay(physicsTuning.clusterPull)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, clusterPull: fromOffSliderPosition(p, CLUSTER_PULL_RANGE.min, CLUSTER_PULL_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Friction"
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.velocityDecay, VELOCITY_DECAY_RANGE.min, VELOCITY_DECAY_RANGE.max)}
								display={sizeDisplay(physicsTuning.velocityDecay)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, velocityDecay: fromSliderPosition(p, VELOCITY_DECAY_RANGE.min, VELOCITY_DECAY_RANGE.max) },
									}))}
							/>
							{/* Depth anchor last: its gated controls read as a sub-section. */}
							<label className="flex items-center justify-between gap-2 text-xs">
								Depth anchor
								<select
									className="rounded border bg-background px-1 py-0.5 text-xs"
									value={physicsTuning.depthMode}
									onChange={(e) =>
										changeSettings((cur) => ({
											...cur,
											physics: { ...cur.physics, depthMode: e.target.value as GraphRenderSettings["physics"]["depthMode"] },
										}))
									}
								>
									<option value="off">Off</option>
									<option value="vertical">Vertical (up)</option>
									<option value="radial">Radial (outward)</option>
								</select>
							</label>
							<SettingSlider
								label="Depth strength"
								disabled={physicsTuning.depthMode === "off"}
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.depthStrength, DEPTH_STRENGTH_RANGE.min, DEPTH_STRENGTH_RANGE.max)}
								display={sizeDisplay(physicsTuning.depthStrength)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, depthStrength: fromSliderPosition(p, DEPTH_STRENGTH_RANGE.min, DEPTH_STRENGTH_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Depth spacing"
								disabled={physicsTuning.depthMode === "off"}
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.depthSpacing, DEPTH_SPACING_RANGE.min, DEPTH_SPACING_RANGE.max)}
								display={sizeDisplay(physicsTuning.depthSpacing)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, depthSpacing: fromSliderPosition(p, DEPTH_SPACING_RANGE.min, DEPTH_SPACING_RANGE.max) },
									}))}
							/>
							<SettingSlider
								label="Base ring radius"
								disabled={physicsTuning.depthMode !== "radial"}
								min={0}
								max={100}
								step={5}
								value={toSliderPosition(physicsTuning.depthBaseRadius, DEPTH_BASE_RADIUS_RANGE.min, DEPTH_BASE_RADIUS_RANGE.max)}
								display={sizeDisplay(physicsTuning.depthBaseRadius)}
								onChange={(p) =>
									changeSettings((cur) => ({
										...cur,
										physics: { ...cur.physics, depthBaseRadius: fromSliderPosition(p, DEPTH_BASE_RADIUS_RANGE.min, DEPTH_BASE_RADIUS_RANGE.max) },
									}))}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * Top-chrome actions. Import always renders, since it is the empty-graph
 * entry point. Search and settings render only when nodes exist, so no
 * control is dead. Exported for the empty and populated SSR tests.
 */
export function GraphChromeRow({
	isEmpty,
	query,
	onQuery,
	noMatch,
	matchCount,
	importing,
	searchInputRef,
	fileInputRef,
	onImportFiles,
	onOpenImport,
	settings,
	changeSettings,
	onOpenChains,
}: {
	isEmpty: boolean;
	query: string;
	onQuery: (v: string) => void;
	/** Shows the "No matching nodes." note; computed by the parent. */
	noMatch: boolean;
	/** Matching node count while a query is set. */
	matchCount?: number;
	importing: boolean;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	onImportFiles: (files: FileList | null) => void;
	/** Opens the file picker: the chrome button and the empty state share it. */
	onOpenImport: () => void;
	settings: GraphRenderSettings;
	changeSettings: (update: (cur: RenderSettings) => RenderSettings) => void;
	onOpenChains: () => void;
}) {
	return (
		<>
			{/* Empty graph: gated controls keep a blank slot, so Import never shifts. */}
			{isEmpty && <div aria-hidden data-testid="chrome-slot" className="h-11 w-40 min-w-0 shrink sm:h-9 sm:w-56" />}
			{!isEmpty && (
				<div className="graph-chrome-fade-in w-40 min-w-0 shrink rounded-xl bg-card px-1 py-[3px] shadow-raise-hi sm:w-56">
					<Hint
						label="Search nodes"
						action="find"
						side="bottom"
					>
					<div className="relative">
						<SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<input
							ref={searchInputRef}
							value={query}
							onChange={(e) => onQuery(e.target.value)}
							placeholder="Search nodes…"
							aria-label="Search nodes"
							spellCheck={false}
							className="h-9 w-full rounded-lg border bg-background pl-8 pr-8 text-xs outline-none placeholder:text-muted-foreground focus:border-ring sm:h-7"
						/>
						{query !== "" && (
							<button
								type="button"
								aria-label="Clear search"
								onClick={() => {
									onQuery("");
									searchInputRef.current?.focus();
								}}
								className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<XIcon className="size-3.5" />
							</button>
						)}
					</div>
					</Hint>
					{query.trim() !== "" && matchCount !== undefined && (
						<div className="px-1.5 pt-1 text-[11px] text-muted-foreground">
							{matchCount === 0 ? "No matches" : `${matchCount} ${matchCount === 1 ? "match" : "matches"}`}
						</div>
					)}
					{noMatch && (
						<div className="px-1.5 pt-1 text-[11px] text-muted-foreground">No matching nodes.</div>
					)}
				</div>
			)}
			{isEmpty && <div aria-hidden data-testid="chrome-slot" className="h-11 w-24 shrink-0 sm:h-9" />}
			{/* Chains button: its own 36px container, between search and Import. */}
			{!isEmpty && (
				<div className="graph-chrome-fade-in w-24 shrink-0 rounded-xl bg-card px-1 py-[3px] shadow-raise-hi">
					<Hint label="Every prerequisite chain" side="bottom">
						<button
							type="button"
							onClick={onOpenChains}
							data-testid="open-chain-table"
							className="flex h-9 w-full items-center justify-center sm:h-7 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
						>
							<ListTreeIcon className="size-3" />
							Chains
						</button>
					</Hint>
				</div>
			)}
			{/* Import notes: always rendered, since it is the empty-graph entry point. */}
			<div className="shrink-0 rounded-xl bg-card px-1 py-[3px] shadow-raise-hi">
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept=".md,.markdown,.txt"
					className="hidden"
					onChange={(e) => {
						onImportFiles(e.target.files);
						e.target.value = ""; // allow re-picking the same file
					}}
				/>
				<Hint
					label="Import notes into the graph"
					side="bottom"
				>
					<button
						type="button"
						disabled={importing}
						onClick={onOpenImport}
						data-testid="import-notes"
						className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50 sm:h-7"
					>
						<UploadIcon className="size-3" />
						{importing ? "Importing…" : "Import notes…"}
					</button>
				</Hint>
			</div>
			{isEmpty && <div aria-hidden data-testid="chrome-slot" className="size-9 shrink-0" />}
			{!isEmpty && (
				// The gear sits at the far right, so its panel drops over less of the graph.
				<div className="graph-chrome-fade-in shrink-0">
					<GraphSettingsControl settings={settings} changeSettings={changeSettings} />
				</div>
			)}
		</>
	);
}

export function GraphView({
	chainSelectOpen = false,
	practiceSelection,
	onPracticeSelectionChange,
	onChainSelectClose,
}: {
	/** Lifted pick set. Every check or clear in the chain table reports the full list here. */
	chainSelectOpen?: boolean;
	practiceSelection?: ReadonlySet<string>;
	onPracticeSelectionChange?: (nodes: { id: string; name: string; statement: string }[]) => void;
	onChainSelectClose?: () => void;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const cardRef = useRef<HTMLDivElement | null>(null);
	const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
	const [selected, setSelected] = useState<Selection | null>(null);
	// Read by renderer callbacks, which are built once and must not close over state.
	const snapshotRef = useRef<GraphSnapshot | null>(null);
	snapshotRef.current = snapshot;

	const [query, setQuery] = useState("");
	// lh:kbd-find (⌘F) is dispatched only to this page.
	const searchInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const onFind = () => searchInputRef.current?.focus();
		window.addEventListener("lh:kbd-find", onFind);
		return () => window.removeEventListener("lh:kbd-find", onFind);
	}, []);
	// Server-persisted (data/render-settings.json). Loaded once after mount; changes save debounced.
	const [settings, setSettings] = useState<GraphRenderSettings>(DEFAULT_RENDER_SETTINGS);
	const regionTuning = settings.regions;
	const physicsTuning = settings.physics;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	// True once the user has moved a control this mount: the server copy
	// must never clobber a (possibly newer) local change.
	const userTouched = useRef(false);
	// Saves wait for the initial GET, so mounting never PUTs defaults over the server copy.
	const serverLoaded = useRef(false);
	const savePending = useRef(false);
	const changeSettings = (update: (cur: RenderSettings) => RenderSettings) => {
		userTouched.current = true;
		setSettings(update);
	};
	const saveToServer = (s: RenderSettings) => {
		fetch("/api/graph/render-settings", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(s),
		}).catch((err) => console.error("[graph] settings save failed:", err));
	};
	useEffect(() => {
		fetch("/api/graph/render-settings")
			.then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
			.then((raw) => {
				if (raw !== null && !userTouched.current) setSettings(sanitizeRenderSettings(raw));
			})
			.catch(() => {
				// server unreachable → in-memory defaults keep working
			})
			.finally(() => {
				serverLoaded.current = true;
				if (savePending.current) {
					savePending.current = false;
					saveToServer(settingsRef.current);
				}
			});
	}, []);
	useEffect(() => {
		if (!userTouched.current) return; // mount-run / server-apply: no save
		if (!serverLoaded.current) {
			savePending.current = true; // hold until the GET settles
			return;
		}
		const id = setTimeout(() => saveToServer(settings), 400);
		return () => clearTimeout(id);
	}, [settings]);

	// The renderer outlives snapshot refetches and settings changes, so its camera never resets.
	// posRef carries the frozen layout from the layout effect.
	const rendererRef = useRef<GraphCanvasRenderer | null>(null);
	const posRef = useRef<Map<string, { x: number; y: number }> | null>(null);

	const visibleIds = useMemo(() => {
		const set = new Set<string>();
		if (snapshot)
			for (const node of snapshot.nodes) {
				if (isNodeVisible(node, query)) set.add(node.id);
			}
		return set;
	}, [snapshot, query]);

	// Bumped when a pipeline run finishes, so the snapshot refetches.
	const [refreshTick, setRefreshTick] = useState(0);
	const [themeTick, setThemeTick] = useState(0);
	// Canvas colors are read once per data feed, so a Day/Night switch has to re-feed them.
	useEffect(() => {
		const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		return () => obs.disconnect();
	}, []);
	// Browsing surface, kept out of graph state.
	const [chainsOpen, setChainsOpen] = useState(false);
	// The parent's chip drives select mode. Closing reports back so both stay in sync.
	useEffect(() => {
		if (chainSelectOpen) setChainsOpen(true);
	}, [chainSelectOpen]);
	useEffect(() => {
		let cancelled = false;
		fetch("/api/graph")
			.then((res) => res.json() as Promise<GraphSnapshot>)
			.then((data) => {
				if (!cancelled) setSnapshot(data);
			})
			.catch((err) => console.error("[graph] fetch failed:", err));
		return () => {
			cancelled = true;
		};
	}, [refreshTick]);

	const fileInputRef = useRef<HTMLInputElement>(null);
	// The import POST awaits the whole pipeline, so the run starts long before the
	// response. Nudge the activity dock at click and again at +600ms to catch the start.
	const refreshActivity = useActivity().refresh;
	const notesImport = useNotesImport({
		onStart: () => {
			refreshActivity();
			setTimeout(() => refreshActivity(), 600);
		},
	});
	const { importing, onImportFiles } = notesImport;

	// Refetch the graph when a run leaves the feed. A run leaves only after its merge,
	// settle, and usage persist are on disk. Rows are tracked by job id, not chatId,
	// so each per-chunk merge reveals on its own.
	const [pipelineRuns, setPipelineRuns] = useState<{ id: string; chatId: string; title: string; phase: string; startedAt: number }[]>([]);
	const rowIdsRef = useRef<Set<string>>(new Set());
	const readPipelineStatus = useCallback(() => {
		fetch("/api/graph/status")
			.then((res) => res.json() as Promise<{ runs: typeof pipelineRuns }>)
			.then(({ runs }) => {
				setPipelineRuns(runs);
				const ids = new Set(runs.map((r) => r.id));
				if ([...rowIdsRef.current].some((id) => !ids.has(id))) setRefreshTick((t) => t + 1);
				rowIdsRef.current = ids;
			})
			.catch(() => {}); // status is cosmetic — never surface read errors
	}, []);
	// Push-driven: the registry emits activity-changed on every phase change and finish.
	// Debounced; resync heals a reconnect that dropped events.
	const statusDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useServerEvent("activity-changed", () => {
		if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
		statusDebounceRef.current = setTimeout(() => {
			statusDebounceRef.current = undefined;
			readPipelineStatus();
		}, 250);
	});
	useServerResync(() => readPipelineStatus());
	useEffect(() => {
		readPipelineStatus();
		return () => {
			if (statusDebounceRef.current) clearTimeout(statusDebounceRef.current);
		};
	}, [readPipelineStatus]);

	// Cumulative cost fold for the cost pill. Best-effort: a failed fetch leaves the last numbers.
	const [costs, setCosts] = useState<GraphCostSummary | null>(null);
	const refreshCosts = useCallback(() => {
		fetch("/api/graph/costs")
			.then((res) => res.json() as Promise<GraphCostSummary>)
			.then(setCosts)
			.catch(() => {});
	}, []);
	useEffect(() => {
		refreshCosts();
	}, [refreshCosts]);
	// Usage persists per job, so costs refresh per job row, not only when the feed drains.
	const prevRunIds = useRef(new Set<string>());
	useEffect(() => {
		const gone = [...prevRunIds.current].some((id) => !pipelineRuns.some((r) => r.id === id));
		if (gone && prevRunIds.current.size > 0) refreshCosts();
		prevRunIds.current = new Set(pipelineRuns.map((r) => r.id));
	}, [pipelineRuns, refreshCosts]);

	/* Deletions never leave the status feed, so lh:graph-revision is the only signal.
	   Refetch the snapshot and costs on each one; a redundant fetch is cheap. */
	useEffect(() => {
		const onRevision = () => {
			setRefreshTick((t) => t + 1);
			refreshCosts();
		};
		window.addEventListener("lh:graph-revision", onRevision);
		return () => window.removeEventListener("lh:graph-revision", onRevision);
	}, [refreshCosts]);

	/* Live rename (lh:chat-renamed): the cluster label updates through the renderer's
	   label-only channel, with no new snapshot object and no geometry rebuild, so a
	   pending drag commit survives. The sessions map is patched in place. */
	const [, setLabelTick] = useState(0);
	useEffect(() => {
		const onRenamed = (e: Event) => {
			const { id, title } = (e as CustomEvent<{ id?: string; title?: string }>).detail ?? {};
			if (typeof id !== "string" || typeof title !== "string" || id === "" || title === "") return;
			const snap = snapshotRef.current;
			if (snap != null) renameSessionsPatch(snap, id, title);
			rendererRef.current?.setClusterLabels(new Map([[id, title]]));
			setLabelTick((t) => t + 1);
		};
		window.addEventListener("lh:chat-renamed", onRenamed);
		return () => window.removeEventListener("lh:chat-renamed", onRenamed);
	}, []);

	// Right-click a node for the Delete menu. The anchor is a zero-size div at the pointer.
	const [ctxNode, setCtxNode] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
	const ctxAnchorRef = useRef<HTMLDivElement | null>(null);
	const [deletingNode, setDeletingNode] = useState<{ id: string; name: string } | null>(null);
	useEffect(() => {
		if (ctxNode === null) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (ctxAnchorRef.current?.contains(target)) return;
			setCtxNode(null);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setCtxNode(null);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [ctxNode]);

	// The positions ledger (written by the server settle after every merge) is the layout.
	// The local incrementalLayout pass runs only when the ledger is absent, e.g. on a fresh install.
	useEffect(() => {
		if (!snapshot || snapshot.nodes.length === 0) return;
		const ledger = snapshot.positions;
		if (ledger) {
			const positions = new Map<string, { x: number; y: number }>();
			for (const node of snapshot.nodes) {
				const p = ledger[node.id];
				if (p) positions.set(node.id, { x: p.x, y: p.y });
			}
			if (positions.size > 0) {
				posRef.current = seedMissingNodePositions(snapshot.nodes, positions);
				return () => {
					posRef.current = null;
				};
			}
		}
		// Same d3-force engine as the server settle, seeded, so the result is deterministic per node set.
		posRef.current = incrementalLayout(snapshot.nodes, snapshot.edges, new Map());
		return () => {
			posRef.current = null;
		};
	}, [snapshot]);

	// Built once the canvas exists and destroyed when it goes away. Callbacks read through refs, so they never go stale.
	const isEmpty = snapshot === null || snapshot.nodes.length === 0;
	useEffect(() => {
		if (isEmpty) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		// Zoom and pan persist per device in localStorage. Absent or corrupt means the renderer fits on open.
		let initialCamera: { k: number; x: number; y: number } | null = null;
		try {
			const stored = localStorage.getItem(CAMERA_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as { k?: unknown; x?: unknown; y?: unknown };
				if (
					typeof parsed.k === "number" && Number.isFinite(parsed.k) && parsed.k > 0 &&
					typeof parsed.x === "number" && Number.isFinite(parsed.x) &&
					typeof parsed.y === "number" && Number.isFinite(parsed.y)
				)
					initialCamera = { k: parsed.k, x: parsed.x, y: parsed.y };
			}
		} catch {
			// Corrupt entry → treat as absent; the renderer fits.
		}
		// Debounced: a pan emits many transforms per second.
		let cameraTimer: ReturnType<typeof setTimeout> | null = null;
		let lastCamera: { k: number; x: number; y: number } | null = null;
		const persistCamera = (t: { k: number; x: number; y: number }) => {
			lastCamera = t;
			if (cameraTimer) clearTimeout(cameraTimer);
			cameraTimer = setTimeout(() => {
				cameraTimer = null;
				try {
					localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(t));
				} catch {
					// Storage full/blocked: camera persistence is best-effort.
				}
			}, 250);
		};
		const renderer = new GraphCanvasRenderer(
			canvas,
			{
				onSelect: (nodeId, pos) => {
					const snap = snapshotRef.current;
					const node = snap?.nodes.find((n) => n.id === nodeId);
					if (!snap || !node) return;
					setSelected({
						node,
						sourceIds: snap.nodeSessions[node.id] ?? [],
						anchor: pos,
					});
				},
				onStageClick: () => setSelected(null),
				// Null (empty stage) closes a stale menu.
				onContext: (nodeId, pos) => {
					if (nodeId === null) {
						setCtxNode(null);
						return;
					}
					const node = snapshotRef.current?.nodes.find((n) => n.id === nodeId);
					if (!node) return;
					setCtxNode({ id: node.id, name: node.name, x: pos.x, y: pos.y });
				},
				// A camera move closes the card and the context menu, and persists the camera.
				onCameraMove: (t) => {
					setSelected(null);
					setCtxNode(null);
					persistCamera(t);
				},
				// Fire-and-forget; the next snapshot fetch carries the ledger anyway.
				onCommit: (positions) => {
					void fetch("/api/graph/positions", {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(positions),
					}).catch((err) => console.error("[graph] positions commit failed", err));
				},
			},
			initialCamera,
		);
		rendererRef.current = renderer;
		return () => {
			rendererRef.current = null;
			// Flush a pending camera write so the last view persists on unmount.
			if (cameraTimer && lastCamera) {
				clearTimeout(cameraTimer);
				cameraTimer = null;
				try {
					localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(lastCamera));
				} catch {
					// best-effort
				}
			}
			renderer.destroy();
		};
	}, [isEmpty]);

	// Feed #1 (data). Runs after the layout and construct effects, so the renderer exists.
	useEffect(() => {
		const renderer = rendererRef.current;
		const positions = posRef.current;
		if (!renderer || !snapshot || snapshot.nodes.length === 0 || !positions) return;
		renderer.setData({
			nodes: snapshot.nodes.map((n) => ({
				id: n.id,
				x: positions.get(n.id)?.x ?? 0,
				y: positions.get(n.id)?.y ?? 0,
				label: n.name,
			})),
			edges: snapshot.edges.map((e) => ({ from: e.from, to: e.to })),
			logicalEdges: snapshot.logicalEdges.map((e) => ({ from: e.from, to: e.to })),
			impLinks: snapshot.impLinks,
			clusters: snapshot.clusters.map((c) => ({ id: c.id, label: regionName(c.label), members: c.members })),
			colors: {
				node: tokenHex(NODE_COLOR_TOKEN),
				edge: tokenHex("--q-ink-4"),
				label: tokenHex("--q-ink-3"),
				hoverText: tokenHex("--q-ink"),
				region: tokenHex("--q-teal"),
			},
			fontFamily: getComputedStyle(document.body).fontFamily,
		});
	}, [snapshot, isEmpty, themeTick]);

	// Feed #2 (settings): marks the frame dirty. No rebuild, no re-layout, no camera move.
	const deferredSettings = useDeferredValue(settings);
	useEffect(() => {
		rendererRef.current?.setSettings(deferredSettings);
	}, [deferredSettings, isEmpty]);

	// Feed #3 (visibility): hidden nodes drop out of rendering, picking, hover, and labels.
	useEffect(() => {
		rendererRef.current?.setVisible(query.trim() ? visibleIds : null);
		// The open detail card cannot outlive its node's visibility.
		setSelected((sel) => (sel && visibleIds.has(sel.node.id) ? sel : null));
	}, [visibleIds, query]);

	// Feed #4 (region tuning). isEmpty is a dep because the settings fetch can resolve
	// before the renderer exists; the load-time run would then hit null and never re-fire.
	useEffect(() => {
		rendererRef.current?.setRegionTuning(regionTuning);
	}, [regionTuning, isEmpty]);

	// Feed #5 (physics): rebuilds the live sim in place; drag pins survive. Same isEmpty dep as Feed #4.
	useEffect(() => {
		rendererRef.current?.setPhysicsTuning(physicsTuning);
	}, [physicsTuning, isEmpty]);

	// Position the detail card: below the clicked node, flipped above near
	// the bottom edge, clamped horizontally. Imperative (ref + layout effect,
	// before paint) because the flip needs the card's measured height.
	useLayoutEffect(() => {
		const card = cardRef.current;
		const container = containerRef.current;
		if (!selected || !card || !container) return;
		const width = card.offsetWidth;
		const height = card.offsetHeight;
		const margin = 8;
		const gap = 12;
		const left = Math.min(
			Math.max(selected.anchor.x - width / 2, margin),
			Math.max(container.clientWidth - width - margin, margin),
		);
		let top = selected.anchor.y + gap;
		if (top + height > container.clientHeight - margin) {
			top = Math.max(selected.anchor.y - gap - height, margin);
		}
		card.style.left = `${left}px`;
		card.style.top = `${top}px`;
		card.style.visibility = "visible";
	}, [selected]);

	const openImportPicker = () => fileInputRef.current?.click();

	return (
		<div className="relative h-full w-full">
			{isEmpty ? (
				// The empty graph keeps the first action clear without zero-valued statistics.
				<div className="flex h-full w-full items-center justify-center px-4">
					<div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
						<WaypointsIcon className="size-10 opacity-40" strokeWidth={1.25} />
						<div className="text-lg font-medium text-foreground">Knowledge graph</div>
						<p className="max-w-sm text-sm">
							Chat with your tutor or import notes to build your graph.
						</p>
						<button
							type="button"
							onClick={openImportPicker}
							disabled={importing}
							data-testid="empty-import-notes"
							className="mt-1 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
						>
							<UploadIcon className="size-4" />
							Import notes
						</button>
					</div>
				</div>
			) : (
				<div ref={containerRef} className="relative h-full w-full">
					{/* One canvas: every layer draws into it, once per frame. */}
					<canvas ref={canvasRef} className="block h-full w-full touch-none" />
					{/* Zero-size anchor at the right-click point. */}
					{ctxNode !== null && (
						<div
							ref={ctxAnchorRef}
							style={{ position: "absolute", left: ctxNode.x, top: ctxNode.y, width: 0, height: 0 }}
						/>
					)}
				</div>
			)}

			{/* Node context menu. Delete is its only action. */}
			{ctxNode !== null && (
				<MenuShell
					anchorRef={ctxAnchorRef}
					testid="node-context-menu"
					preferredSide="down"
					menuClass="flex w-fit flex-col gap-0.5 q-card p-2 text-xs shadow-xl"
				>
					<button
						type="button"
						data-testid="ctx-node-delete"
						onClick={() => {
							setDeletingNode({ id: ctxNode.id, name: ctxNode.name });
							setCtxNode(null);
						}}
						className="flex items-center rounded-lg px-2.5 py-1.5 text-left text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
					>
						Delete
					</button>
				</MenuShell>
			)}

			{/* Portals to body itself; kept here for state locality. */}
			<DeleteNodeDialog
				nodes={deletingNode ? [deletingNode] : null}
				onClose={() => setDeletingNode(null)}
				onDeleted={(nodeIds, graphRevision) => {
					setDeletingNode(null);
					if (selected && nodeIds.includes(selected.node.id)) setSelected(null);
					window.dispatchEvent(new CustomEvent("lh:graph-revision", { detail: { graphRevision } }));
				}}
			/>



			{/* Top-right controls. lh-no-drag: Electron's drag mask ignores z-index, so these need a carve-out. */}
			{/* The row never wraps on desktop; in narrow windows the search shrinks instead. */}
			<div className="lh-no-drag lh-wco-floating absolute right-2 top-2 z-10 flex max-w-[calc(100%-5.5rem)] flex-col items-end gap-2">
			{/* z-20 keeps open dropdowns above the cost number below. */}
			<div className="relative z-20 flex min-w-0 flex-wrap items-start justify-end gap-2 sm:flex-nowrap sm:justify-start">
				{/* Import always; search and settings only when nodes exist. */}
				<GraphChromeRow
					isEmpty={isEmpty}
					query={query}
					onQuery={setQuery}
					noMatch={snapshot !== null && visibleIds.size === 0 && query.trim() !== ""}
					matchCount={snapshot !== null && query.trim() !== "" ? visibleIds.size : undefined}
					importing={importing}
					searchInputRef={searchInputRef}
					fileInputRef={fileInputRef}
					onImportFiles={onImportFiles}
					onOpenImport={openImportPicker}
					settings={settings}
					changeSettings={changeSettings}
					onOpenChains={() => setChainsOpen(true)}
				/>
			</div>

			<NotesImportErrors errors={notesImport.errors} />
			{/* Cost number, then the running-pipeline pills under it. */}
			{costs && costs.runs.length > 0 && <GraphCostControl costs={costs} />}
			{pipelineRuns.map((run) => (
				<div
					key={run.id}
					className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-raise-hi"
				>
					<Loader2Icon className="size-3.5 shrink-0 animate-spin" />
					<span className="capitalize">{run.phase}</span>
					<span className="max-w-48 truncate text-foreground">{run.title}</span>
					<span className="tabular-nums">{Math.max(0, Math.round((Date.now() - run.startedAt) / 1000))}s</span>
				</div>
			))}
			</div>

			{selected && !isEmpty && (
				<div
					ref={cardRef}
					// Placed imperatively in the layout effect; hidden until then so a flip never flashes.
					style={{ visibility: "hidden", left: 0, top: 0 }}
					// lh-no-drag: stays interactive when it lands over the top drag strip.
					className="lh-no-drag absolute z-10 w-80 max-w-[calc(100%-1rem)] rounded-xl bg-card p-4 text-left shadow-raise-hi"
				>
					<div className="text-sm font-medium leading-snug">{selected.node.name}</div>
					<div className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.node.statement}</div>
					{selected.sourceIds.length > 0 ? (
						<div className="mt-3 flex flex-col gap-1">
							<div className="text-xs text-muted-foreground">From</div>
							{selected.sourceIds.map((sourceId) => {
								// An imported-notes file: a STATIC entry — the path,
								// plain text, never a link (no session to open).
								if (snapshot?.fileSources?.[sourceId] !== undefined) {
									return (
										<div key={sourceId} className="flex items-center gap-1.5">
											<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
											<span className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-muted-foreground">
												{snapshot.fileSources[sourceId]}
											</span>
										</div>
									);
								}
								// A real session: deep-linkable provenance.
								return (
									<div key={sourceId} className="flex items-center gap-1.5">
										<Link
											href={propositionSessionHref(selected.node, sourceId)}
											scroll={false}
											className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
										>
											{snapshot?.sessions[sourceId] ?? sourceId}
										</Link>
									</div>
								);
							})}
						</div>
					) : (
						<div className="mt-3 text-xs text-muted-foreground">Not from any chat or notes.</div>
					)}
				</div>
			)}
			{/* Absolute inside the graph area, not a body portal. Last child on purpose: app-region
			    hit-testing follows DOM order, not z-index, so it must come after the drag band it covers. */}
			<ChainTableOverlay
				open={chainsOpen && !isEmpty}
				nodes={snapshot?.propositions ?? []}
				chains={snapshot?.chains ?? []}
				sessions={snapshot?.sessions ?? {}}
				fileSources={snapshot?.fileSources ?? {}}
				onClose={() => {
					setChainsOpen(false);
					onChainSelectClose?.();
				}}
				selectMode={chainSelectOpen}
				controlledSelection={practiceSelection}
				onSelectionChange={(ids) => {
					const props = snapshot?.propositions ?? [];
					const picked: { id: string; name: string; statement: string }[] = [];
					for (const id of ids) {
						const n = props.find((node) => node.id === id);
						if (n) picked.push({ id: n.id, name: n.name, statement: n.statement });
					}
					onPracticeSelectionChange?.(picked);
				}}
			/>		</div>
	);
}
