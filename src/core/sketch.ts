export type SketchStep = { step: number; caption: string };

export type Sketch = {
	viewBox: string;
	width: number;
	height: number;
	label: string;
	body: string;
	steps: SketchStep[];
};

export const SKETCH_MAX_STEPS = 9;
const DRAW_STAGGER_SECONDS = 0.05;
const DRAW_LAST_START_SECONDS = 1.6;

export const SKETCH_MAX_SOURCE = 24_000;
export const SKETCH_MAX_ELEMENTS = 400;

const PAINT_TOKENS: Record<string, string> = {
	ink: "ink",
	graphite: "graphite",
	faint: "faint",
	soft: "faint",
	rule: "rule",
	mark: "mark",
	accent: "mark",
	wash: "wash",
	paper: "paper",
};

export const SKETCH_TOKEN_NAMES = ["ink", "graphite", "faint", "rule", "mark", "wash", "paper"] as const;

const SHAPES = new Set(["path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);
const TEXTS = new Set(["text", "tspan"]);
const CONTAINERS = new Set(["g"]);
const ELEMENTS = new Set([...SHAPES, ...TEXTS, ...CONTAINERS, "title"]);

const PRESENTATION = [
	"fill",
	"stroke",
	"stroke-width",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-dasharray",
	"opacity",
	"fill-opacity",
	"stroke-opacity",
	"font-family",
	"font-size",
	"font-weight",
	"font-style",
	"letter-spacing",
	"text-anchor",
	"dominant-baseline",
];

const GEOMETRY: Record<string, string[]> = {
	g: ["transform"],
	path: ["d", "transform"],
	circle: ["cx", "cy", "r", "transform"],
	ellipse: ["cx", "cy", "rx", "ry", "transform"],
	line: ["x1", "y1", "x2", "y2", "transform"],
	polyline: ["points", "transform"],
	polygon: ["points", "transform"],
	rect: ["x", "y", "width", "height", "rx", "ry", "transform"],
	text: ["x", "y", "dx", "dy", "transform"],
	tspan: ["x", "y", "dx", "dy"],
	title: [],
};

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/i;
const NUMBER_LIST = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?[\s,]*)+$/i;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/;
const TRANSFORM = /^(?:\s*(?:translate|rotate|scale|matrix|skewX|skewY)\(\s*[-\d.,\se]+\)\s*,?)+$/;

const KEYWORDS: Record<string, Set<string>> = {
	"stroke-linecap": new Set(["round", "butt", "square"]),
	"stroke-linejoin": new Set(["round", "miter", "bevel"]),
	"font-weight": new Set(["normal", "bold", "400", "500", "600", "700"]),
	"font-style": new Set(["normal", "italic"]),
	"text-anchor": new Set(["start", "middle", "end"]),
	"dominant-baseline": new Set(["auto", "middle", "central", "hanging", "alphabetic"]),
};

function decodeEntities(raw: string): string {
	return raw.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, name: string) => {
		const lower = name.toLowerCase();
		if (lower === "amp") return "&";
		if (lower === "lt") return "<";
		if (lower === "gt") return ">";
		if (lower === "quot") return '"';
		if (lower === "apos") return "'";
		if (lower === "nbsp") return " ";
		const code = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
		return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
	});
}

function escapeText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

function hexLuminance(hex: string): number | null {
	const digits = hex.slice(1);
	const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
	if (!/^[\da-f]{6}$/i.test(full)) return null;
	const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function paint(value: string): string | null {
	const v = value.trim();
	if (v === "none" || v === "currentColor" || v === "transparent") return v === "transparent" ? "none" : v;
	const token = /^var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)$/.exec(v);
	if (token) {
		const name = token[1]!.replace(/^riddle-/, "");
		const mapped = PAINT_TOKENS[name];
		return mapped ? `var(--sk-${mapped})` : "var(--sk-ink)";
	}
	const lower = v.toLowerCase();
	if (lower === "white") return "var(--sk-paper)";
	if (lower === "black") return "var(--sk-ink)";
	if (lower === "gray" || lower === "grey") return "var(--sk-graphite)";
	const luminance = lower.startsWith("#") ? hexLuminance(lower) : null;
	if (luminance === null) return "var(--sk-ink)";
	if (luminance >= 0.7) return "var(--sk-paper)";
	if (luminance <= 0.3) return "var(--sk-ink)";
	return "var(--sk-graphite)";
}

export function sketchValue(property: string, value: string): string | null {
	const v = decodeEntities(value).trim();
	if (v.length === 0 || v.length > 2000) return null;
	if (/url\s*\(|expression|javascript:|@import|[\\<>]/i.test(v)) return null;
	switch (property) {
		case "fill":
		case "stroke":
			return paint(v);
		case "font-family":
			return "var(--sk-font)";
		case "d":
			return PATH_DATA.test(v) ? v : null;
		case "points":
		case "stroke-dasharray":
			return v === "none" || NUMBER_LIST.test(v) ? v : null;
		case "transform":
			return TRANSFORM.test(v) ? v : null;
		default: {
			const keywords = KEYWORDS[property];
			if (keywords) return keywords.has(v) ? v : null;
			return NUMBER.test(v) ? v : null;
		}
	}
}

function styleValue(raw: string): string | null {
	const kept: string[] = [];
	for (const declaration of decodeEntities(raw).split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		const property = declaration.slice(0, colon).trim().toLowerCase();
		if (!PRESENTATION.includes(property)) continue;
		const value = sketchValue(property, declaration.slice(colon + 1));
		if (value !== null) kept.push(`${property}:${value}`);
	}
	return kept.length > 0 ? kept.join(";") : null;
}

function attributes(tag: string): Map<string, string> {
	const found = new Map<string, string>();
	const pattern = /\s([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
	for (const match of tag.matchAll(pattern)) {
		found.set(match[1]!, match[2] ?? match[3] ?? "");
	}
	return found;
}

function keptAttributes(element: string, found: Map<string, string>): string {
	const allowed = new Set([...(GEOMETRY[element] ?? []), ...(element === "title" ? [] : PRESENTATION), ...(element === "title" ? [] : ["style"])]);
	const out: string[] = [];
	for (const [name, raw] of found) {
		const lower = name.toLowerCase();
		if (!allowed.has(lower) && !allowed.has(name)) continue;
		const value = lower === "style" ? styleValue(raw) : sketchValue(lower, raw);
		if (value !== null) out.push(` ${lower}="${escapeAttribute(value)}"`);
	}
	return out.join("");
}

function parseViewBox(raw: string | undefined): { viewBox: string; width: number; height: number } | null {
	if (!raw) return null;
	const parts = raw.trim().split(/[\s,]+/).map(Number);
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
	const [x, y, width, height] = parts as [number, number, number, number];
	if (width <= 0 || height <= 0 || width > 2000 || height > 4000) return null;
	return { viewBox: `${x} ${y} ${width} ${height}`, width, height };
}

function stepAttributes(found: Map<string, string>, steps: Map<number, string>): string {
	const step = Number(found.get("data-step"));
	if (!Number.isInteger(step) || step < 1 || step > SKETCH_MAX_STEPS) return "";
	const caption = decodeEntities(found.get("data-caption") ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
	if (!steps.has(step) || (caption && !steps.get(step))) steps.set(step, caption);
	return ` data-step="${step}"`;
}

function withDrawing(name: string, kept: string, order: number): string {
	const drawn = TEXTS.has(name) ? ` class="ink-fade"` : SHAPES.has(name) && !/stroke-dasharray/.test(kept) ? ` pathLength="1" class="ink-draw"` : null;
	if (drawn === null) return kept;
	const delay = `--ink-delay:${Math.min(order * DRAW_STAGGER_SECONDS, DRAW_LAST_START_SECONDS).toFixed(2)}s`;
	const timed = kept.includes(' style="') ? kept.replace(' style="', ` style="${delay};`) : `${kept} style="${delay}"`;
	return timed + drawn;
}

export function parseSketch(source: string, options: { animate?: boolean } = {}): Sketch | null {
	if (source.length > SKETCH_MAX_SOURCE) return null;
	const tokens = source.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/?[a-zA-Z][^<>]*?\/?>|[^<]+/g);
	if (!tokens) return null;

	let root: { viewBox: string; width: number; height: number } | null = null;
	let rootStyle = "";
	let closed = false;
	let skipDepth = 0;
	let elements = 0;
	let label = "";
	const open: string[] = [];
	const body: string[] = [];
	const steps = new Map<number, string>();

	for (const token of tokens) {
		if (closed) break;
		if (token.startsWith("<!--") || token.startsWith("<![CDATA[") || token.startsWith("<?") || token.startsWith("<!")) continue;
		if (!token.startsWith("<")) {
			if (skipDepth > 0) continue;
			const current = open[open.length - 1];
			if (current && (TEXTS.has(current) || current === "title")) {
				const text = decodeEntities(token);
				if (current === "title") label += text;
				else body.push(escapeText(text));
			}
			continue;
		}

		const closing = token.startsWith("</");
		const name = /^<\/?([a-zA-Z][\w:-]*)/.exec(token)?.[1]?.toLowerCase() ?? "";
		const selfClosing = !closing && token.endsWith("/>");

		if (!root) {
			if (closing || name !== "svg") continue;
			const found = attributes(token);
			root = parseViewBox(found.get("viewBox") ?? found.get("viewbox"));
			if (!root) {
				const width = Number.parseFloat(found.get("width") ?? "");
				const height = Number.parseFloat(found.get("height") ?? "");
				root = parseViewBox(`0 0 ${width} ${height}`);
			}
			if (!root) return null;
			rootStyle = keptAttributes("g", new Map([...found].filter(([key]) => key !== "transform")));
			if (selfClosing) closed = true;
			continue;
		}

		if (closing) {
			if (skipDepth > 0) {
				skipDepth--;
				continue;
			}
			if (name === "svg") {
				closed = true;
				continue;
			}
			if (open[open.length - 1] === name) {
				open.pop();
				if (name !== "title") body.push(`</${name}>`);
			}
			continue;
		}

		if (skipDepth > 0 || !ELEMENTS.has(name) || (name === "tspan" && open[open.length - 1] !== "text" && open[open.length - 1] !== "tspan")) {
			if (!selfClosing) skipDepth++;
			continue;
		}

		elements++;
		if (elements > SKETCH_MAX_ELEMENTS) return null;
		if (name === "title") {
			if (!selfClosing) open.push("title");
			continue;
		}
		const found = attributes(token);
		let kept = keptAttributes(name, found);
		if (name === "g") kept += stepAttributes(found, steps);
		if (options.animate && name !== "tspan") kept = withDrawing(name, kept, elements);
		if (selfClosing) {
			body.push(`<${name}${kept}/>`);
		} else {
			body.push(`<${name}${kept}>`);
			open.push(name);
		}
	}

	if (!root || !closed) return null;
	while (open.length > 0) {
		const name = open.pop()!;
		if (name !== "title") body.push(`</${name}>`);
	}
	return {
		...root,
		label: label.trim().replace(/\s+/g, " ").slice(0, 200),
		body: `<g${rootStyle}>${body.join("")}</g>`,
		steps: [...steps].sort(([a], [b]) => a - b).map(([step, caption]) => ({ step, caption })),
	};
}
