import { render, type TextMeasurer } from "pele";
import type { PlanNodeStatus } from "@/src/core";

/** Node titles are drawn at this size in svg units. The in-chat block caps
 *  its width at the natural size, so titles never exceed chat prose. */
export const PLAN_FONT_SIZE = 14;
export const CHAT_PAD = 8;
/** The current node's glow reaches past its box, so the popup and the
 *  marginalia pad by more than the chat block, which has no glow. */
export const GLOW_PAD = 24;

const TITLE_MAX_CHARS = 28;

export interface PlanDiagramNode {
	id: string;
	title: string;
}

export interface PlanDiagramEdge {
	from: string;
	to: string;
}

export interface PlanDiagramSvg {
	svg: string;
	width: number;
	height: number;
}

export interface PlanRenderOptions {
	monochrome: boolean;
	pad: number;
}

// Pele measures text with the browser's canvas when a document exists, so the
// same plan lays out differently on the server and the client, and React
// rejects the markup. This estimate is DOM-free and deterministic. Its scale
// was calibrated in the browser on real plan titles in Geist: canvas measured
// 1.03–1.12 times the estimate, mean 1.09, so 1.1 keeps boxes just wider than
// their text.
const GEIST_SCALE = 1.1;
const NARROW_CHARS = new Set(" ijltfr.,:;'!|()[]-\\");
const WIDE_CHARS = new Set("mwMW@");
const CAP_DIGIT = /[A-Z0-9]/;

function estimateWidth(text: string, size: number): number {
	let w = 0;
	for (const ch of text) {
		if (NARROW_CHARS.has(ch)) w += 3.1;
		else if (WIDE_CHARS.has(ch)) w += 9.2;
		else if (CAP_DIGIT.test(ch)) w += 6.0;
		else w += 5.4;
	}
	// The classes above are fitted at 11 units, which the layout scales from.
	return (w * size * GEIST_SCALE) / 11;
}

const measurer: TextMeasurer = {
	width: (text, size) => estimateWidth(text, size),
};

/** Greedy word wrap, one line per box line. Long words are chunked so
 *  nothing is dropped. */
export function wrapTitle(title: string, maxChars = TITLE_MAX_CHARS): string[] {
	const words = title.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const atoms: string[] = [];
	for (const word of words) {
		for (let i = 0; i < word.length; i += maxChars) atoms.push(word.slice(i, i + maxChars));
	}
	const lines: string[] = [];
	for (const atom of atoms) {
		const last = lines[lines.length - 1];
		if (last !== undefined && last.length + 1 + atom.length <= maxChars) {
			lines[lines.length - 1] = `${last} ${atom}`;
		} else {
			lines.push(atom);
		}
	}
	return lines;
}

/** Mermaid reads `#name;` as an entity and ends a quoted label at `"`, so
 *  both travel as entities. */
function escapeLabel(line: string): string {
	return line.replace(/#/g, "#35;").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;");
}

interface ShortEdge {
	from: string;
	to: string;
	fromStatus: PlanNodeStatus;
	toStatus: PlanNodeStatus;
}

/** Edges between known nodes, by short id (`p0`, `p1`, …), each pair once.
 *  Short ids keep arbitrary agent slugs away from the parser. */
function shortEdges(
	nodes: readonly PlanDiagramNode[],
	edges: readonly PlanDiagramEdge[],
	statusOf: (id: string) => PlanNodeStatus,
): ShortEdge[] {
	const short = new Map(nodes.map((n, i) => [n.id, `p${i}`] as const));
	const seen = new Set<string>();
	const out: ShortEdge[] = [];
	for (const e of edges) {
		const from = short.get(e.from);
		const to = short.get(e.to);
		if (!from || !to || seen.has(`${from}>${to}`)) continue;
		seen.add(`${from}>${to}`);
		out.push({ from, to, fromStatus: statusOf(e.from), toStatus: statusOf(e.to) });
	}
	return out;
}

function flowchartSource(
	nodes: readonly PlanDiagramNode[],
	edges: readonly ShortEdge[],
	statusOf: (id: string) => PlanNodeStatus,
	monochrome: boolean,
): string {
	const lines = ["flowchart TD"];
	nodes.forEach((n, i) => {
		const label = wrapTitle(n.title).map(escapeLabel).join("<br/>");
		lines.push(`  p${i}["${label}"]`);
	});
	for (const e of edges) lines.push(`  ${e.from} --> ${e.to}`);
	if (!monochrome) nodes.forEach((n, i) => lines.push(`  class p${i} ${statusOf(n.id)}`));
	return lines.join("\n");
}

/** Lays out and draws the plan. Null when there is nothing to draw. */
export function renderPlan(
	nodes: readonly PlanDiagramNode[],
	edges: readonly PlanDiagramEdge[],
	statusOf: (id: string) => PlanNodeStatus,
	options: PlanRenderOptions,
): PlanDiagramSvg | null {
	if (nodes.length === 0) return null;
	const linked = shortEdges(nodes, edges, statusOf);
	const rendered = render(flowchartSource(nodes, linked, statusOf, options.monochrome), {
		fontSize: PLAN_FONT_SIZE,
		padding: options.pad,
		measurer,
	});
	let svg = rendered.svg;
	if (!options.monochrome) {
		// An arrow is white only when both of its ends are visited or current.
		for (const e of linked) {
			if (e.fromStatus !== "upcoming" && e.toStatus !== "upcoming") continue;
			const id = `L_${e.from}_${e.to}_0`;
			svg = svg.replace(`class="pele-edge" data-id="${id}"`, `class="pele-edge dim" data-id="${id}"`);
		}
	}
	return { svg, width: rendered.width, height: rendered.height };
}
