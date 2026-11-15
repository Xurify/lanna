import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverScene, type CoverMotif } from "../components/reading/cover-scene.tsx";

const outDir = process.argv[2]!;
const order = (process.argv[3] ?? "").split(",").filter(Boolean) as CoverMotif[];
mkdirSync(outDir, { recursive: true });
const papers = { day: ["#f3eee3", "#e8efe7", "#e6edf2", "#f3eae6", "#ecebe6"], night: ["#26241e", "#1f2621", "#1e242a", "#28211f", "#242422"] };

function sheet(night: boolean): string {
	const ink = night ? "#ecedee" : "#16181b", ink2 = night ? "#c3c7cb" : "#3f444a", ink3 = night ? "#9399a0" : "#656b72", teal = night ? "#4cbdb7" : "#0d6764", teal2 = night ? "#7bd3ce" : "#0a5452";
	const cells = order.map((motif, i) => {
		const svg = renderToStaticMarkup(<CoverScene motif={motif} seed={101 + i * 37} />);
		return `<figure><div class="art" style="background:${papers[night ? "night" : "day"][i % 5]}">${svg}</div><figcaption>${i + 1}</figcaption></figure>`;
	});
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#101214" : "#ffffff"};color:${ink};font-family:sans-serif}
.grid{display:grid;grid-template-columns:repeat(3,360px);gap:20px}
figure{margin:0}.art{aspect-ratio:5/3;padding:8px 6px 2px;border-radius:12px}figcaption{font-size:20px;font-weight:700;color:${ink3};padding:6px 4px}
svg{display:block;width:100%;height:100%}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}
.font-prose{font-family:"Source Sans 3","Segoe UI",sans-serif}.stroke-current{stroke:currentColor}.fill-none{fill:none}.fill-current{fill:currentColor}.fill-teal-2{fill:${teal2}}
.fill-teal\\/20{fill:color-mix(in srgb,${teal} 20%,transparent)}.q-ink-patch{fill:color-mix(in srgb,${teal} ${night ? 30 : 20}%,transparent)}
</style><div class="grid">${cells.join("")}</div>`;
}
writeFileSync(path.join(outDir, "sheet-light.html"), sheet(false));
writeFileSync(path.join(outDir, "sheet-dark.html"), sheet(true));
