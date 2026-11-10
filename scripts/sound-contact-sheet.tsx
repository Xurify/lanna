/**
 * Every mouth drawing of the sound notes on one page, in Day or Night, for
 * checking a drawing by eye before it ships (the ink-drawing skill):
 *
 *   npx tsx scripts/sound-contact-sheet.tsx <out-dir> [shapes | blind | <language id>]
 *   chrome --headless=new --window-size=1000,2300 --screenshot=<out-dir>/sheet-light.png file:///<out-dir>/sheet-light.html
 *
 * `shapes` (the default) draws every tongue shape with its name. `blind`
 * draws pairs of pictures as the app shows them, with a number and no
 * name, for the blind review.
 * A language id draws the pictures of that language's sounds, each next to
 * the sound it is compared with. Tailwind is not built here, so the few
 * utility classes the drawings use are restated below with the app's Day and
 * Night token values.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { SoundDrawing } from "../components/phonology/mouth.tsx";
import { TONGUE_SHAPES, getSoundNotes, type LipShape, type SoundPicture, type TongueShape } from "../src/core/sound-notes.ts";

const outDir = process.argv[2];
const mode = process.argv[3] ?? "shapes";
if (!outDir) throw new Error("usage: npx tsx scripts/sound-contact-sheet.tsx <out-dir> [shapes | blind | <language id>]");
mkdirSync(outDir, { recursive: true });

const LIPS_FOR_SHAPE: Partial<Record<TongueShape, LipShape>> = { "back-mid": "round", "back-high": "round", "front-high": "spread", "middle-high": "spread" };

const draw = (picture: SoundPicture, seed: number, quiet = false) => renderToStaticMarkup(<SoundDrawing picture={picture} seed={seed} quiet={quiet} />);

const mouth = (tongue: TongueShape, lips: LipShape = "neutral", mark?: "lips" | "throat"): SoundPicture => ({ kind: "mouth", mouth: { tongue, lips, ...(mark ? { mark } : {}) } });
const BLIND: SoundPicture[][] = [
	[mouth("tip-ridge"), mouth("body-roof")],
	[mouth("back-roof"), mouth("back-near-roof")],
	[mouth("back-high", "round"), mouth("front-high", "round")],
	[mouth("back-mid", "round", "lips"), mouth("back-mid", "spread", "lips")],
	[mouth("front-high", "spread"), mouth("middle-high", "spread")],
	[mouth("tip-teeth"), mouth("tip-teeth-middle-up")],
	[mouth("blade-roof"), mouth("tip-back", "round")],
	[mouth("tip-ridge"), mouth("tip-ridge-trill")],
	[mouth("back-near-roof"), mouth("rest", "neutral", "throat")],
	[mouth("back-high", "round"), mouth("rest", "lip-to-teeth")],
	[mouth("tip-teeth-middle-up"), mouth("tip-teeth-back-up")],
	[mouth("back-low"), mouth("front-low")],
	[mouth("tip-ridge"), mouth("tip-ridge-middle-up")],
	[{ kind: "length", units: 1 }, { kind: "length", units: 2 }],
	[{ kind: "length", units: 1 }, { kind: "length", units: 2 }, { kind: "length", units: 3 }],
];

function cells(): string[] {
	if (mode === "blind") {
		return BLIND.map(
			(row, i) =>
				`<figure class="two"><b>${i + 1}</b>${row.map((picture, j) => `<div>${draw(picture, 500 + i * 30 + j, j === 0)}<span>${"ABC"[j]}</span></div>`).join("")}</figure>`,
		);
	}
	if (mode === "shapes") {
		const pictures: Array<{ name: string; picture: SoundPicture }> = [
			...TONGUE_SHAPES.map((tongue) => ({ name: `${tongue} · ${LIPS_FOR_SHAPE[tongue] ?? "neutral"}`, picture: { kind: "mouth" as const, mouth: { tongue, lips: LIPS_FOR_SHAPE[tongue] ?? ("neutral" as const) } } })),
			{ name: "front-high · round", picture: { kind: "mouth", mouth: { tongue: "front-high", lips: "round" } } },
			{ name: "back-mid · spread", picture: { kind: "mouth", mouth: { tongue: "back-mid", lips: "spread" } } },
			{ name: "rest · lip-to-teeth", picture: { kind: "mouth", mouth: { tongue: "rest", lips: "lip-to-teeth" } } },
			{ name: "rest · throat", picture: { kind: "mouth", mouth: { tongue: "rest", lips: "neutral", mark: "throat" } } },
			{ name: "length 1", picture: { kind: "length", units: 1 } },
			{ name: "length 2", picture: { kind: "length", units: 2 } },
			{ name: "length 3", picture: { kind: "length", units: 3 } },
		];
		return pictures.map((p, i) => `<figure><div>${draw(p.picture, 40 + i * 20)}</div><figcaption>${p.name}</figcaption></figure>`);
	}
	const data = getSoundNotes(mode);
	if (!data) throw new Error(`no sound notes for ${mode}`);
	return data.sounds
		.flatMap((s) => (s.picture && s.next ? [{ ...s, picture: s.picture, next: s.next }] : []))
		.map(
		(s, i) =>
			`<figure class="two"><div>${draw(s.next.picture, 300 + i * 40, true)}<span>${s.next.symbol} · ${s.next.word}</span></div><div>${draw(s.picture, 320 + i * 40)}<span class="on">${s.symbol} · ${s.word}</span></div><figcaption>${s.how}</figcaption></figure>`,
	);
}

function sheet(night: boolean): string {
	const ink = night ? "#e9eaec" : "#15181b";
	const ink2 = night ? "#c3c7cb" : "#3f444a";
	const ink3 = night ? "#9399a0" : "#656b72";
	const teal = night ? "#4fb8b2" : "#0e7c79";
	const teal2 = night ? "#7bd3ce" : "#0a5452";
	const line = night ? "#2f3438" : "#e8e8e5";
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#14171a" : "#fbfaf7"};color:${ink};font-family:"Segoe UI",sans-serif}
.grid{display:grid;grid-template-columns:repeat(${mode === "shapes" ? 4 : 2},1fr);gap:16px}
figure{margin:0;padding:10px;border:1px solid ${line};border-radius:14px}
figure.two{display:flex;flex-wrap:wrap;gap:8px}figure.two>div{flex:1 1 0;min-width:0}figure.two figcaption,figure.two b{flex:0 0 100%}figure.two b{font-size:18px}
.fill-foreground\\/\\[0\\.14\\]{fill:color-mix(in srgb,${ink} 14%,transparent)}.fill-foreground\\/\\[0\\.05\\]{fill:color-mix(in srgb,${ink} 5%,transparent)}.fill-teal\\/10{fill:color-mix(in srgb,${teal} 10%,transparent)}
figure div{display:flex;flex-direction:column;align-items:center;justify-content:center}
figure span{font-size:15px;font-weight:600;color:${ink2}}figure span.on{color:${teal2}}
figcaption{font-size:13px;color:${ink3};text-align:center}
svg{width:100%;height:auto;max-width:260px}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}
.stroke-current{stroke:currentColor}.fill-none{fill:none}.fill-current{fill:currentColor}.fill-teal-2{fill:${teal2}}
.fill-teal\\/20{fill:color-mix(in srgb,${teal} 20%,transparent)}
.ink-draw{stroke-dasharray:1 2;stroke-dashoffset:0}.ink-fade{opacity:1}
</style><div class="grid">${cells().join("")}</div>`;
}

writeFileSync(path.join(outDir, "sheet-light.html"), sheet(false));
writeFileSync(path.join(outDir, "sheet-dark.html"), sheet(true));
console.log(`${cells().length} drawings written to ${outDir}`);
