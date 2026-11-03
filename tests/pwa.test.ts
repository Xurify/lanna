import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "../app/manifest";

// The home-screen install (app/manifest.ts, scripts/make-pwa-icons.mjs): the
// manifest must open full screen at the root, in the app's own colors, and
// every icon it names must exist at the size it declares.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The pixel size of a PNG, from its IHDR chunk (width at byte 16, height at 20). */
function pngSize(relativePath: string): { width: number; height: number } {
	const bytes = readFileSync(join(ROOT, relativePath));
	assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${relativePath} is a PNG`);
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("the manifest opens full screen at the root, in the app's colors", () => {
	const m = manifest();
	assert.equal(m.start_url, "/");
	assert.equal(m.display, "standalone");
	assert.equal(m.background_color, "#ffffff");
	assert.equal(m.theme_color, "#ffffff");
});

test("every manifest icon exists at the size it declares, and one is maskable", () => {
	const icons = manifest().icons ?? [];
	assert.ok(icons.length >= 3, "an any-purpose 192 and 512, plus a maskable 512");
	assert.ok(icons.some((icon) => icon.purpose === "maskable"), "a maskable icon");
	for (const icon of icons) {
		const src = String(icon.src);
		const [width, height] = String(icon.sizes).split("x").map(Number);
		assert.deepEqual(pngSize(join("public", src)), { width, height }, `${src} is ${icon.sizes}`);
	}
});

test("the iOS home-screen icon is a full 180 px square", () => {
	assert.deepEqual(pngSize("app/apple-icon.png"), { width: 180, height: 180 });
});
