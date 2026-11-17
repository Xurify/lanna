/**
 * Layout-shift check (project rule: no layout shift). Loads every route in headless Edge or Chrome
 * and sums the page's `layout-shift` entries, cold and warm, at desktop and phone size, in Day and
 * Night, under a slow network and a slow CPU. Exits 1 when any load scores above the limit.
 *
 *   node scripts/cls-check.mjs --base http://127.0.0.1:3011 --pptr C:\path\to\node_modules
 *
 * Measure a production build (`npm run build`, then `next start` on a sandbox data folder): the dev
 * server's compiles and hot reload shift the page on their own. `--pptr` is a node_modules folder
 * that holds puppeteer-core (the sandbox recipe in docs/development.md); `--browser` is the browser
 * executable (defaults to Edge on Windows, Chrome elsewhere). `--limit 0.01` is the failing score;
 * `--routes /,/review` narrows the run; `--quick` skips Night and the phone size; `--interact`
 * also runs the interactions below (a shift a click causes is not part of the web-vitals score, but
 * a panel that pushes the page down after a click is still a shift, so these count it).
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const base = arg("base", "http://127.0.0.1:3010");
const limit = Number(arg("limit", "0.01"));
const pptrDir = arg("pptr", process.env.PUPPETEER_NODE_MODULES ?? "node_modules");
const executablePath = arg(
	"browser",
	process.platform === "win32"
		? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
		: process.platform === "darwin"
			? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
			: "/usr/bin/google-chrome",
);
if (!existsSync(executablePath)) throw new Error(`no browser at ${executablePath}; pass --browser`);
const puppeteer = createRequire(`${pptrDir.replace(/[\\/]$/, "")}/`)("puppeteer-core");

const ROUTES = (
	arg("routes", "") ||
	"/,/review,/listen,/read,/speak,/watch,/speed?mode=fast,/mistakes,/grammar,/curriculum,/milestones,/progress,/words,/map,/chat/new,/log,/lesson,/start,/nowhere"
).split(",");
const SIZES = flag("quick")
	? [[1440, 900]]
	: [
			[1440, 900],
			[390, 844],
		];
const THEMES = flag("quick") ? ["day"] : ["day", "night"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: "new" });
const rows = [];

/** Interactions: [name, route, size, steps(page)]. Each is scored from a clean counter after the page settles. */
const click = async (page, sel) => {
	await page.waitForSelector(sel, { timeout: 8000 });
	await page.click(sel);
};
const INTERACTIONS = [
	["review: show meaning", "/review", [1440, 900], async (p) => click(p, '[data-testid="review-hint"]')],
	[
		"review: wrong answer, verdict",
		"/review",
		[1440, 900],
		async (p) => {
			await click(p, '[data-testid="review-input"]');
			await p.keyboard.type("zzz");
			await p.keyboard.press("Enter");
		},
	],
	[
		"review: choosing mode",
		"/review",
		[1440, 900],
		async (p) => {
			await click(p, '[data-testid="review-settings-toggle"]');
			await click(p, '[data-testid="review-mode-choice"]');
		},
	],
	[
		"review (phone): wrong answer",
		"/review",
		[390, 844],
		async (p) => {
			await click(p, '[data-testid="review-input"]');
			await p.keyboard.type("zzz");
			await p.keyboard.press("Enter");
		},
	],
	[
		"log: switch to the previous day",
		"/log",
		[1440, 900],
		async (p) => {
			await p.waitForSelector('[role="tab"]');
			const tabs = await p.$$('[role="tab"]');
			if (tabs[1]) await tabs[1].click();
		},
	],
	[
		"jump bar: open and type",
		"/",
		[1440, 900],
		async (p) => {
			await click(p, '[data-testid="jump-bar"]');
			await p.keyboard.type("rev");
		},
	],
	["settings: open from the rail", "/", [1440, 900], async (p) => click(p, 'button[aria-label="Settings"]')],
	["drawer (phone): open the menu", "/", [390, 844], async (p) => click(p, '[aria-label="Open sidebar"]')],
	[
		"read: tap a word",
		"/read?id=ep-001-robo-na-trhu",
		[1440, 900],
		async (p) => {
			await p.waitForSelector("[data-word]");
			await p.click("[data-word]");
		},
	],
	[
		"today: tap the next task's Start area (hover only)",
		"/",
		[1440, 900],
		async (p) => {
			await p.waitForSelector('[data-testid="daily-plan"]');
			await p.hover('[data-testid="daily-plan"] button');
		},
	],
];

for (const route of ROUTES) {
	for (const [width, height] of SIZES) {
		for (const theme of THEMES) {
			const context = await browser.createBrowserContext();
			const page = await context.newPage();
			await page.setViewport({ width, height, isMobile: width < 500, hasTouch: width < 500 });
			await page.setCookie({ name: "lanna-theme", value: theme, url: `${base}/` });
			const cdp = await page.createCDPSession();
			await cdp.send("Network.enable");
			await cdp.send("Network.emulateNetworkConditions", {
				offline: false,
				latency: 100,
				downloadThroughput: (3000 * 1024) / 8,
				uploadThroughput: (1500 * 1024) / 8,
			});
			await cdp.send("Emulation.setCPUThrottlingRate", { rate: 3 });
			await page.evaluateOnNewDocument(() => {
				window.__shifts = [];
				window.__cls = 0;
				new PerformanceObserver((list) => {
					for (const e of list.getEntries()) {
						window.__raw = (window.__raw ?? 0) + e.value;
						if (e.hadRecentInput) continue;
						window.__cls += e.value;
						window.__shifts.push({
							at: Math.round(e.startTime),
							value: Math.round(e.value * 10000) / 10000,
							nodes: (e.sources || []).map(
								(s) => `${s.node?.nodeName ?? "?"}.${String(s.node?.className ?? "").slice(0, 40)}`,
							),
						});
					}
				}).observe({ type: "layout-shift", buffered: true });
			});
			for (const cache of ["cold", "warm"]) {
				try {
					if (cache === "cold") await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 90000 });
					else await page.reload({ waitUntil: "load", timeout: 90000 });
					await sleep(3500);
					const { cls, shifts } = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
					const top = shifts.sort((a, b) => b.value - a.value)[0];
					rows.push({
						route,
						size: `${width}`,
						theme,
						cache,
						cls: Math.round(cls * 1000) / 1000,
						top: top ? `${top.value} ${top.nodes[0] ?? ""}` : "",
					});
				} catch (e) {
					rows.push({ route, size: `${width}`, theme, cache, cls: NaN, top: String(e.message).slice(0, 60) });
				}
			}
			await context.close();
		}
	}
}
if (flag("interact")) {
	for (const [name, route, [width, height], steps] of INTERACTIONS) {
		const context = await browser.createBrowserContext();
		const page = await context.newPage();
		await page.setViewport({ width, height, isMobile: width < 500, hasTouch: width < 500 });
		await page.setCookie({ name: "lanna-theme", value: "day", url: `${base}/` });
		await page.evaluateOnNewDocument(() => {
			window.__raw = 0;
			window.__top = [];
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) {
					window.__raw += e.value;
					if (e.value > 0.002)
						window.__top.push({
							value: Math.round(e.value * 10000) / 10000,
							node: (e.sources?.[0]?.node?.className ?? "").toString().slice(0, 40),
						});
				}
			}).observe({ type: "layout-shift", buffered: true });
		});
		try {
			await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 90000 });
			await sleep(3000);
			await page.evaluate(() => {
				window.__raw = 0;
				window.__top = [];
			});
			await steps(page);
			await sleep(1500);
			const { raw, top } = await page.evaluate(() => ({ raw: window.__raw, top: window.__top }));
			rows.push({
				route: name,
				size: String(width),
				theme: "day",
				cache: "click",
				cls: Math.round(raw * 1000) / 1000,
				top: top.sort((a, b) => b.value - a.value)[0] ? `${top[0].value} ${top[0].node}` : "",
			});
		} catch (e) {
			rows.push({
				route: name,
				size: String(width),
				theme: "day",
				cache: "click",
				cls: NaN,
				top: String(e.message).slice(0, 60),
			});
		}
		await context.close();
	}
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("route", 24)}${pad("size", 6)}${pad("theme", 7)}${pad("cache", 6)}${pad("CLS", 8)}top shift`);
for (const r of rows)
	console.log(`${pad(r.route, 24)}${pad(r.size, 6)}${pad(r.theme, 7)}${pad(r.cache, 6)}${pad(r.cls, 8)}${r.top}`);
const bad = rows.filter((r) => !(r.cls <= limit));
console.log(
	bad.length
		? `\n${bad.length} of ${rows.length} loads above ${limit}`
		: `\nAll ${rows.length} loads at or under ${limit}`,
);
process.exit(bad.length ? 1 : 0);
