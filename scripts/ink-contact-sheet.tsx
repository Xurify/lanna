/**
 * Every case sketch of every unit on one page, in Day or Night, for checking a
 * drawing by eye before it ships (the ink-drawing skill):
 *
 *   npx tsx scripts/ink-contact-sheet.tsx <out-dir>
 *   chrome --headless=new --window-size=1000,2300 --screenshot=<out-dir>/sheet-light.png file:///<out-dir>/sheet-light.html
 *
 * It writes sheet-light.html and sheet-dark.html with the strokes already drawn.
 * Tailwind is not built here, so the few utility classes the sketches use are
 * restated below with the app's Day and Night token values.
 */

import React from "react";
(globalThis as Record<string, unknown>).React = React;

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseSketch, SKETCH_UNITS, sketchStages } from "../components/lesson/case-sketch.tsx";
import { unitInfo } from "../src/core/lesson.ts";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: npx tsx scripts/ink-contact-sheet.tsx <out-dir>");
mkdirSync(outDir, { recursive: true });

const cells = SKETCH_UNITS.flatMap((unit) =>
	sketchStages(unit).map((stage, index) => {
		const svg = renderToStaticMarkup(<CaseSketch unit={unit} stage={index} />);
		const sentence = `${stage.before}${stage.base}<span class="end">${stage.ending}</span>${stage.after}`;
		return `<figure><div>${svg}</div><figcaption>${unitInfo(unit).grammarTerm ?? unitInfo(unit).title} · ${stage.label}<br><span class="sentence">${sentence}</span></figcaption></figure>`;
	}),
);

function sheet(night: boolean): string {
	const ink = night ? "#e9eaec" : "#15181b";
	const ink2 = night ? "#c3c7cb" : "#3f444a";
	const ink3 = night ? "#9399a0" : "#656b72";
	const teal = night ? "#4fb8b2" : "#0e7c79";
	const teal2 = night ? "#7bd3ce" : "#0a5452";
	const line = night ? "#2f3438" : "#e8e8e5";
	const line2 = night ? "#454b51" : "#d8d9d5";
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#14171a" : "#fbfaf7"};color:${ink};font-family:"Segoe UI",sans-serif}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
figure{margin:0;padding:12px;border:1px solid ${line};border-radius:14px}
figcaption{font-size:13px;color:${ink3};text-align:center}
.sentence{font-size:20px;font-weight:600;color:${ink}}.end{color:${teal2}}
svg{width:100%;height:auto;max-width:420px}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}.text-line-2{color:${line2}}
.stroke-current{stroke:currentColor}.stroke-teal-2{stroke:${teal2}}.fill-none{fill:none}.fill-current{fill:currentColor}.fill-teal-2{fill:${teal2}}
.fill-teal\\/20{fill:color-mix(in srgb,${teal} 20%,transparent)}
.font-prose{font-family:"Segoe UI",sans-serif}.text-\\[15px\\]{font-size:15px}.font-semibold{font-weight:600}
.ink-draw{stroke-dasharray:1 2;stroke-dashoffset:0}.ink-fade{opacity:1}
</style><div class="grid">${cells.join("")}</div>`;
}

writeFileSync(path.join(outDir, "sheet-light.html"), sheet(false));
writeFileSync(path.join(outDir, "sheet-dark.html"), sheet(true));
console.log(`${cells.length} sketches written to ${outDir}`);
