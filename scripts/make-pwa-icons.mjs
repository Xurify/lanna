// Renders the home-screen icons from the brand mark (build/mark.svg) on the
// app's dark background. Run from the repo root: node scripts/make-pwa-icons.mjs
//
//   public/icons/icon-192.png          "any" purpose, the glyph at 70% of the tile
//   public/icons/icon-512.png          "any" purpose, the same at 512
//   public/icons/icon-maskable-512.png "maskable": the glyph at 56%, inside the
//                                      80% safe circle a launcher may crop to
//   app/apple-icon.png                 180 px iOS home-screen tile; iOS rounds the
//                                      corners itself, so it is a full square
//
// The output is committed; re-run this only when build/mark.svg changes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const BACKGROUND = "#141414";
const mark = readFileSync("build/mark.svg", "utf8");
// Everything inside the mark's own <svg> element: the glyph and its comments.
const glyph = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

function tile(scale) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">` +
		`<rect width="1024" height="1024" fill="${BACKGROUND}"/>` +
		`<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${glyph}</g></svg>`;
}

const outputs = [
	{ file: "public/icons/icon-192.png", size: 192, scale: 0.7 },
	{ file: "public/icons/icon-512.png", size: 512, scale: 0.7 },
	{ file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.56 },
	{ file: "app/apple-icon.png", size: 180, scale: 0.7 },
];

for (const { file, size, scale } of outputs) {
	mkdirSync(dirname(file), { recursive: true });
	const png = new Resvg(tile(scale), { fitTo: { mode: "width", value: size } }).render().asPng();
	writeFileSync(file, png);
	console.log(file, png.length, "bytes");
}
