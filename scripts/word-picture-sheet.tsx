import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimalScene } from "../components/lesson/animal-scene.tsx";
import { BodyScene } from "../components/lesson/body-scene.tsx";
import { ClothesScene } from "../components/lesson/clothes-scene.tsx";
import { FoodScene } from "../components/lesson/food-scene.tsx";
import { HomeScene } from "../components/lesson/home-scene.tsx";
import { NatureScene } from "../components/lesson/nature-scene.tsx";
import { TransportScene } from "../components/lesson/transport-scene.tsx";
import { WeatherScene } from "../components/lesson/weather-scene.tsx";
import {
	ANIMAL_SCENES,
	BODY_SCENES,
	CLOTHES_SCENES,
	FOOD_SCENES,
	HOME_SCENES,
	NATURE_SCENES,
	TRANSPORT_SCENES,
	WEATHER_SCENES,
	type AnimalScene as Animal,
	type BodyScene as Body,
	type ClothesScene as Clothes,
	type FoodScene as Food,
	type HomeScene as Home,
	type NatureScene as Nature,
	type TransportScene as Transport,
	type WeatherScene as Weather,
} from "../src/core/word-pictures.ts";

const usage =
	"Usage: npx tsx scripts/word-picture-sheet.tsx <dir> <weather|food|home|nature|animal|body|transport|clothes> [scene,...]";
const outDir = process.argv[2];
const set = process.argv[3];
const SETS: Record<string, readonly string[]> = {
	weather: WEATHER_SCENES,
	food: FOOD_SCENES,
	home: HOME_SCENES,
	nature: NATURE_SCENES,
	animal: ANIMAL_SCENES,
	body: BODY_SCENES,
	transport: TRANSPORT_SCENES,
	clothes: CLOTHES_SCENES,
};
if (!outDir || !set || !SETS[set]) {
	console.error(usage);
	process.exit(1);
}
const all = SETS[set]!;
const order = process.argv[4]?.split(",") ?? [...all];
const unknown = order.filter((s) => !all.includes(s));
if (unknown.length) {
	console.error(`Not a ${set} scene: ${unknown.join(", ")}\n${usage}`);
	process.exit(1);
}
const DRAW: Record<string, (scene: string) => React.JSX.Element> = {
	weather: (scene) => <WeatherScene scene={scene as Weather} />,
	food: (scene) => <FoodScene scene={scene as Food} />,
	home: (scene) => <HomeScene scene={scene as Home} />,
	nature: (scene) => <NatureScene scene={scene as Nature} />,
	animal: (scene) => <AnimalScene scene={scene as Animal} />,
	body: (scene) => <BodyScene scene={scene as Body} />,
	transport: (scene) => <TransportScene scene={scene as Transport} />,
	clothes: (scene) => <ClothesScene scene={scene as Clothes} />,
};
const draw = (scene: string) => renderToStaticMarkup(DRAW[set]!(scene));

mkdirSync(outDir, { recursive: true });
function sheet(night: boolean, labels: boolean, tile: number): string {
	const ink = night ? "#ecedee" : "#16181b",
		ink2 = night ? "#c3c7cb" : "#3f444a",
		ink3 = night ? "#9399a0" : "#656b72",
		teal2 = night ? "#7bd3ce" : "#0a5452";
	const cells = order.map(
		(s, i) => `<figure><div class="art">${draw(s)}</div><figcaption>${labels ? s : i + 1}</figcaption></figure>`,
	);
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#101214" : "#ffffff"};color:${ink};font-family:sans-serif}
.grid{display:grid;grid-template-columns:repeat(${tile < 200 ? 8 : 4},${tile}px);gap:20px}
figure{margin:0}.art{aspect-ratio:200/130;padding:6px;border-radius:12px;background:${night ? "#1a1c1f" : "#f4f3ef"}}figcaption{font-size:20px;font-weight:700;color:${ink3};padding:6px 4px}
svg{display:block;width:100%;height:100%}
.ink-draw,.ink-fade{opacity:1}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}
.text-background{color:${night ? "#1a1c1f" : "#f4f3ef"}}.fill-teal\\/20{fill:${night ? "rgb(76 189 183 / 0.2)" : "rgb(13 103 100 / 0.2)"}}.fill-teal\\/40{fill:${night ? "rgb(76 189 183 / 0.4)" : "rgb(13 103 100 / 0.4)"}}
.stroke-current{stroke:currentColor}.fill-none{fill:none}.fill-current{fill:currentColor}.fill-teal-2{fill:${teal2}}
.q-wash-ochre{fill:${night ? "rgb(236 200 128 / 0.15)" : "rgb(214 170 90 / 0.34)"}}.q-wash-rose{fill:${night ? "rgb(240 160 146 / 0.15)" : "rgb(206 128 112 / 0.28)"}}.q-wash-sage{fill:${night ? "rgb(160 210 150 / 0.14)" : "rgb(122 160 110 / 0.3)"}}.q-wash-sky{fill:${night ? "rgb(150 195 240 / 0.15)" : "rgb(108 150 190 / 0.28)"}}
</style><div class="grid">${cells.join("")}</div>`;
}
writeFileSync(path.join(outDir, "sheet-light.html"), sheet(false, false, 300));
writeFileSync(path.join(outDir, "sheet-dark.html"), sheet(true, false, 300));
writeFileSync(path.join(outDir, "sheet-small.html"), sheet(false, false, 120));
writeFileSync(path.join(outDir, "sheet-labeled.html"), sheet(false, true, 300));
