import React from "react";
(globalThis as Record<string, unknown>).React = React;
import fs, { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
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
	"Usage: npx tsx scripts/word-picture-sheet.tsx <dir> <set[,set2,...]|all> [scene,...] [--png] [--chrome path]";
const rawArgs = process.argv.slice(2);
const renderPng = rawArgs.includes("--png");
const chromeIndex = rawArgs.indexOf("--chrome");
const chromeOverride = chromeIndex >= 0 ? rawArgs[chromeIndex + 1] : process.env.CHROME_PATH;
const positional = rawArgs.filter(
	(arg, index) => arg !== "--png" && arg !== "--chrome" && (chromeIndex < 0 || index !== chromeIndex + 1),
);
const outDir = positional[0];
const setArg = positional[1];
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
const selectedSets = setArg === "all" ? Object.keys(SETS) : (setArg?.split(",").filter(Boolean) ?? []);
if (!outDir || selectedSets.length === 0 || selectedSets.some((name) => !SETS[name])) {
	console.error(usage);
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

interface TileEntry {
	set: string;
	scene: string;
}

const allTiles: TileEntry[] = selectedSets.flatMap((setName) =>
	SETS[setName]!.map((scene) => ({ set: setName, scene })),
);
const requestedFilter = positional[2]?.split(",").filter(Boolean);
const tiles: TileEntry[] = requestedFilter
	? requestedFilter.map((spec) => {
			const [maybeSet, maybeScene] = spec.includes(":") ? spec.split(":") : [undefined, spec];
			const match = allTiles.find((tile) => (maybeSet ? tile.set === maybeSet : true) && tile.scene === maybeScene);
			if (!match) {
				console.error(`Not a scene in ${selectedSets.join(",")}: ${spec}\n${usage}`);
				process.exit(1);
			}
			return match;
		})
	: allTiles;

const drawTile = (tile: TileEntry) => renderToStaticMarkup(DRAW[tile.set]!(tile.scene));

mkdirSync(outDir, { recursive: true });
function sheet(night: boolean, labels: boolean, tileWidth: number): string {
	const ink = night ? "#ecedee" : "#16181b",
		ink2 = night ? "#c3c7cb" : "#3f444a",
		ink3 = night ? "#9399a0" : "#656b72",
		teal2 = night ? "#7bd3ce" : "#0a5452";
	const cells = tiles.map(
		(tile, index) =>
			`<figure><div class="art">${drawTile(tile)}</div><figcaption>${labels ? (selectedSets.length > 1 ? `${tile.set}:${tile.scene}` : tile.scene) : index + 1}</figcaption></figure>`,
	);
	return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${night ? "#101214" : "#ffffff"};color:${ink};font-family:sans-serif}
.grid{display:grid;grid-template-columns:repeat(${tileWidth < 200 ? 8 : 4},${tileWidth}px);gap:20px}
figure{margin:0}.art{aspect-ratio:200/130;padding:6px;border-radius:12px;background:${night ? "#1a1c1f" : "#f4f3ef"}}figcaption{font-size:20px;font-weight:700;color:${ink3};padding:6px 4px}
svg{display:block;width:100%;height:100%}
.ink-draw,.ink-fade{opacity:1}
.text-foreground{color:${ink}}.text-ink-2{color:${ink2}}.text-ink-3{color:${ink3}}.text-teal-2{color:${teal2}}
.text-background{color:${night ? "#1a1c1f" : "#f4f3ef"}}.fill-teal\\/20{fill:${night ? "rgb(76 189 183 / 0.2)" : "rgb(13 103 100 / 0.2)"}}.fill-teal\\/40{fill:${night ? "rgb(76 189 183 / 0.4)" : "rgb(13 103 100 / 0.4)"}}
.stroke-current{stroke:currentColor}.fill-none{fill:none}.fill-current{fill:currentColor}.fill-teal-2{fill:${teal2}}
.q-wash-ochre{fill:${night ? "rgb(236 200 128 / 0.15)" : "rgb(214 170 90 / 0.34)"}}.q-wash-rose{fill:${night ? "rgb(240 160 146 / 0.15)" : "rgb(206 128 112 / 0.28)"}}.q-wash-sage{fill:${night ? "rgb(160 210 150 / 0.14)" : "rgb(122 160 110 / 0.3)"}}.q-wash-sky{fill:${night ? "rgb(150 195 240 / 0.15)" : "rgb(108 150 190 / 0.28)"}}
</style><div class="grid">${cells.join("")}</div>`;
}

const files = [
	{
		html: path.join(outDir, "sheet-light.html"),
		png: path.join(outDir, "sheet-light.png"),
		night: false,
		labels: false,
		tileWidth: 300,
	},
	{
		html: path.join(outDir, "sheet-dark.html"),
		png: path.join(outDir, "sheet-dark.png"),
		night: true,
		labels: false,
		tileWidth: 300,
	},
	{
		html: path.join(outDir, "sheet-small.html"),
		png: path.join(outDir, "sheet-small.png"),
		night: false,
		labels: false,
		tileWidth: 120,
	},
	{
		html: path.join(outDir, "sheet-labeled.html"),
		png: path.join(outDir, "sheet-labeled.png"),
		night: false,
		labels: true,
		tileWidth: 300,
	},
];

for (const item of files) {
	writeFileSync(item.html, sheet(item.night, item.labels, item.tileWidth));
}

if (renderPng) {
	const executablePath = [
		chromeOverride,
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
	]
		.filter((candidate): candidate is string => Boolean(candidate))
		.find((candidate) => fs.existsSync(candidate));
	if (!executablePath) {
		console.error("no Chrome found for --png: pass --chrome <path> or set CHROME_PATH");
		process.exit(1);
	}
	const browser = await puppeteer.launch({ executablePath, headless: true });
	const page = await browser.newPage();
	try {
		await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 2 });
		for (const item of files) {
			await page.goto(pathToFileURL(path.resolve(item.html)).href, { waitUntil: "load" });
			await page.screenshot({ path: item.png, fullPage: true });
			console.log(item.png);
		}
	} finally {
		await browser.close();
	}
}
