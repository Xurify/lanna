import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { WeatherScene } from "../components/lesson/weather-scene.tsx";
import { WEATHER_SCENES, type WeatherScene as Scene } from "../src/core/word-pictures.ts";

const outDir = process.argv[2]!;
const order = (process.argv[3]?.split(",") ?? [...WEATHER_SCENES]) as Scene[];
mkdirSync(outDir, { recursive: true });
function sheet(night: boolean, labels: boolean): string {
	const ink = night ? "#ecedee" : "#16181b",
		ink2 = night ? "#c3c7cb" : "#3f444a",
		ink3 = night ? "#9399a0" : "#656b72",
		teal2 = night ? "#7bd3ce" : "#0a5452";
	const cells = order.map(
		(s, i) =>
			`<figure><div class="art">${renderToStaticMarkup(<WeatherScene scene={s} />)}</div><figcaption>${labels ? s : i + 1}</figcaption></figure>`,
	);
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#101214" : "#ffffff"};color:${ink};font-family:sans-serif}
.grid{display:grid;grid-template-columns:repeat(4,300px);gap:20px}
figure{margin:0}.art{aspect-ratio:200/130;padding:6px;border-radius:12px;background:${night ? "#1a1c1f" : "#f4f3ef"}}figcaption{font-size:20px;font-weight:700;color:${ink3};padding:6px 4px}
svg{display:block;width:100%;height:100%}
.ink-draw,.ink-fade{opacity:1}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}
.stroke-current{stroke:currentColor}.fill-none{fill:none}.fill-teal-2{fill:${teal2}}
.q-wash-ochre{fill:${night ? "rgb(236 200 128 / 0.15)" : "rgb(214 170 90 / 0.34)"}}.q-wash-rose{fill:${night ? "rgb(240 160 146 / 0.15)" : "rgb(206 128 112 / 0.28)"}}.q-wash-sage{fill:${night ? "rgb(160 210 150 / 0.14)" : "rgb(122 160 110 / 0.3)"}}.q-wash-sky{fill:${night ? "rgb(150 195 240 / 0.15)" : "rgb(108 150 190 / 0.28)"}}
</style><div class="grid">${cells.join("")}</div>`;
}
writeFileSync(path.join(outDir, "sheet-light.html"), sheet(false, false));
writeFileSync(path.join(outDir, "sheet-dark.html"), sheet(true, false));
writeFileSync(path.join(outDir, "sheet-labeled.html"), sheet(false, true));
