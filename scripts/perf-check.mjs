/**
 * Perf check (LangHarness, 2026-11-02): how fast the production build feels.
 *
 *   npm run build
 *   node scripts/perf-check.mjs                 # measure, print tables
 *   node scripts/perf-check.mjs --check         # also fail when a budget in BUDGETS is broken
 *   node scripts/perf-check.mjs --json out.json # keep the raw numbers
 *   node scripts/perf-check.mjs --runs 5        # runs per measurement (median is reported)
 *   node scripts/perf-check.mjs --light         # only the demo week (default adds scripts/perf-seed.ts: a year of reviews)
 *   node scripts/perf-check.mjs --cpu 4         # emulate a CPU four times slower (laptop on battery, phone)
 *
 * Dev mode is not representative (no minification, on-demand compile), so this
 * serves `next start` from the existing build. It never uses your own data:
 * LH_DATA_DIR is a new folder under the OS temp dir, seeded with the demo week
 * (scripts/demo-measured-minutes.ts, as `npm run dev:sandbox -- --seed` does),
 * with keys hidden and a free port. Nothing is deleted afterwards.
 *
 * It drives headless Edge through puppeteer-core. Where to find them:
 *   PUPPETEER_CORE  folder holding node_modules/puppeteer-core (default: this checkout, then ../langharness-learning-ui)
 *   BROWSER_PATH    the browser executable (default: Edge on Windows)
 *
 * What it measures
 *   nav    click on a sidebar link -> the URL changes (url) and -> the DOM stops changing (stable)
 *   cold   a full page load: first paint, load event, API calls the page makes (the waterfall),
 *          JS bytes the route pulls, long tasks (>50 ms) and their total
 *   act    interactions: pointerdown -> next frame painted (paint, INP-style) and
 *          pointerdown -> the result is on screen (done)
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const RUNS = Number(opt("--runs", "3"));
const CHECK = flag("--check");
const JSON_OUT = opt("--json", "");
/** CPU slowdown factor (1 = this PC). A laptop on battery or a phone is 4x or worse. */
const CPU = Number(opt("--cpu", "1"));

/** Budgets for --check, in ms (median of RUNS, production build, headless Edge on a dev PC).
 *  They are loose on purpose: they catch a regression of the kind that made the app feel
 *  slow (a serial fetch chain, a blocking write), not noise. Tighten when the numbers settle. */
export const BUDGETS = {
	navUrlMs: 250,
	navStableMs: 600,
	coldLoadMs: 1500,
	apiMs: 250,
	longTaskTotalMs: 400,
	jsKbPerRoute: 1400,
	actPaintMs: 100,
	actDoneMs: 400,
};

const ROUTES = [
	{ path: "/", door: "today-door", name: "Today" },
	{ path: "/curriculum", door: "path-door", name: "Climb" },
	{ path: "/review", door: "review-door", name: "Review" },
	{ path: "/read", door: "stories-door", name: "Stories" },
	{ path: "/speak", door: "speak-door", name: "Speak" },
	{ path: "/words", door: "words-door", name: "Words" },
	{ path: "/plan", door: "plan-door", name: "Progress" },
	{ path: "/milestones", name: "Milestones" },
	{ path: "/map", name: "Map" },
	{ path: "/mistakes", name: "Mistakes" },
	{ path: "/grammar", name: "Grammar" },
	{ path: "/lesson?unit=words", name: "Lesson" },
];

const median = (xs) => {
	const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
	return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};
const r0 = (x) => (x == null ? "-" : String(Math.round(x)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
	return new Promise((resolve, reject) => {
		const s = net.createServer();
		s.once("error", reject);
		s.listen(0, "127.0.0.1", () => {
			const { port } = s.address();
			s.close(() => resolve(port));
		});
	});
}

function loadPuppeteer() {
	const roots = [process.env.PUPPETEER_CORE, ROOT, path.resolve(ROOT, "..", "langharness-learning-ui"), "C:/Users/Stream/Projects/langharness-learning-ui"].filter(Boolean);
	for (const r of roots) {
		try {
			return createRequire(path.join(r, "package.json"))("puppeteer-core");
		} catch {
			/* try the next one */
		}
	}
	throw new Error("puppeteer-core not found; set PUPPETEER_CORE to a folder that has node_modules/puppeteer-core");
}

function findBrowser() {
	const cands = [process.env.BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean);
	const hit = cands.find((p) => fs.existsSync(p));
	if (!hit) throw new Error("no browser found; set BROWSER_PATH");
	return hit;
}

/** Start `next start` on a seeded scratch profile. */
async function startServer() {
	if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) throw new Error("no production build; run `npm run build` first");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-perf-"));
	const env = { ...process.env, LH_DATA_DIR: dir, LH_AUTH_FILE: path.join(dir, "auth.json"), LH_IGNORE_ENV_KEYS: "1", NODE_ENV: "production" };
	delete env.LH_DESKTOP_SERVER;
	delete env.LH_DESKTOP_API_SECRET;
	const seed = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "demo-measured-minutes.ts")], { cwd: ROOT, env: { ...env, NODE_ENV: "development" }, encoding: "utf8" });
	if (seed.status !== 0) throw new Error(`seed failed: ${seed.stderr || seed.stdout}`);
	if (!flag("--light")) {
		const heavy = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "perf-seed.ts")], { cwd: ROOT, env: { ...env, NODE_ENV: "development" }, encoding: "utf8" });
		if (heavy.status !== 0) throw new Error(`heavy seed failed: ${heavy.stderr || heavy.stdout}`);
		console.log(heavy.stdout.trim());
	}
	const port = await freePort();
	const next = createRequire(path.join(ROOT, "package.json")).resolve("next/dist/bin/next");
	const child = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
	let log = "";
	child.stdout.on("data", (c) => (log += c));
	child.stderr.on("data", (c) => (log += c));
	const base = `http://127.0.0.1:${port}`;
	for (let i = 0; i < 100; i++) {
		try {
			const r = await fetch(`${base}/api/progress`);
			if (r.ok) return { base, dir, stop: () => (process.platform === "win32" ? spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }) : child.kill()) };
		} catch {
			/* not up yet */
		}
		await sleep(300);
	}
	throw new Error(`server did not start:\n${log}`);
}

/** Runs in every page before its scripts: long tasks, and a pointer/keyboard -> next-paint probe. */
const PROBE = () => {
	window.__lh = { long: [], acts: [], mut: 0 };
	try {
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__lh.long.push({ s: e.startTime, d: e.duration });
		}).observe({ type: "longtask", buffered: true });
	} catch {
		/* unsupported */
	}
	const paintAfter = (cb) => requestAnimationFrame(() => setTimeout(cb, 0));
	for (const type of ["pointerdown", "keydown"]) {
		addEventListener(
			type,
			(ev) => {
				const t0 = ev.timeStamp;
				paintAfter(() => window.__lh.acts.push({ type, t0, paint: performance.now() - t0 }));
			},
			true,
		);
	}
	new MutationObserver(() => {
		window.__lh.mut = performance.now();
	}).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
};

async function newPage(browser, vp = { width: 1280, height: 800 }) {
	const page = await browser.newPage();
	await page.setViewport(vp);
	await page.evaluateOnNewDocument(PROBE);
	if (CPU > 1) await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: CPU });
	return page;
}

/** Wait until the DOM has not mutated for `quiet` ms; resolve to the time of the last mutation. */
const stableAfter = (page, quiet = 250) =>
	page.evaluate(
		(q) =>
			new Promise((res) => {
				const tick = () => (performance.now() - window.__lh.mut >= q ? res(window.__lh.mut) : setTimeout(tick, 25));
				tick();
			}),
		quiet,
	);

async function cold(browser, base, route) {
	const page = await newPage(browser);
	const reqs = [];
	const cdp = await page.createCDPSession();
	await cdp.send("Network.enable");
	await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
	const t0 = Date.now();
	await page.goto(base + route.path, { waitUntil: "load" });
	await sleep(100);
	await stableAfter(page);
	const m = await page.evaluate(() => {
		const nav = performance.getEntriesByType("navigation")[0];
		const fcp = performance.getEntriesByName("first-contentful-paint")[0];
		const res = performance.getEntriesByType("resource");
		const js = res.filter((e) => e.name.includes("/_next/static/") && e.name.endsWith(".js"));
		const api = res
			.filter((e) => e.name.includes("/api/"))
			.map((e) => ({ url: e.name.replace(location.origin, ""), start: e.startTime, ttfb: e.responseStart - e.requestStart, dur: e.responseEnd - e.startTime }));
		return {
			ttfb: nav.responseStart,
			fcp: fcp ? fcp.startTime : null,
			load: nav.loadEventEnd,
			stable: window.__lh.mut,
			jsBytes: js.reduce((a, e) => a + (e.encodedBodySize || e.decodedBodySize || 0), 0),
			jsCount: js.length,
			api,
			long: window.__lh.long,
		};
	});
	void t0;
	void reqs;
	await page.close();
	return m;
}

/** Click a link in an already-loaded app and time the route change. */
async function navClick(page, base, from, route) {
	await page.goto(base + from, { waitUntil: "load" });
	await sleep(400);
	await stableAfter(page, 200);
	const sel = `[data-testid="${route.door}"]`;
	await page.waitForSelector(sel);
	await page.evaluate(() => {
		window.__lh.acts.length = 0;
	});
	const want = route.path.split("?")[0];
	const urlP = page.evaluate(
		(want) =>
			new Promise((res) => {
				const t = () => (location.pathname === want ? res(performance.now()) : setTimeout(t, 4));
				t();
			}),
		want,
	);
	await page.click(sel);
	const urlAt = await urlP;
	const stableAt = await stableAfter(page, 250);
	const a = await page.evaluate(() => window.__lh.acts.find((x) => x.type === "pointerdown"));
	return { url: urlAt - a.t0, stable: stableAt - a.t0, paint: a.paint };
}

/** Time one interaction. `go` performs it (page.click ...); `done` is a page-side predicate. */
async function act(page, go, done, arg) {
	await page.evaluate(() => {
		window.__lh.acts.length = 0;
	});
	const doneP = page.evaluate(
		(src, arg) =>
			new Promise((res, rej) => {
				const f = new Function(`return (${src})`)();
				const dl = performance.now() + 8000;
				const t = () => {
					if (f(arg)) return res(performance.now());
					if (performance.now() > dl) return rej(new Error("timeout waiting for result"));
					setTimeout(t, 2);
				};
				// the probe records the pointerdown time; poll from then
				addEventListener("pointerdown", () => t(), { capture: true, once: true });
				addEventListener("keydown", () => t(), { capture: true, once: true });
			}),
		done.toString(),
		arg,
	);
	await go();
	const at = await doneP;
	await sleep(60);
	const a = await page.evaluate(() => window.__lh.acts[0]);
	return { paint: a.paint, done: at - a.t0 };
}

const click = (page, sel) => () => page.click(sel);

async function interactions(browser, base) {
	const out = [];
	const add = (name, runs) => out.push({ name, paint: median(runs.map((r) => r?.paint)), done: median(runs.map((r) => r?.done)), n: runs.length });
	const safe = async (name, fn) => {
		const runs = [];
		for (let i = 0; i < RUNS; i++) {
			try {
				runs.push(await fn(i));
			} catch (e) {
				console.error(`  ! ${name}: ${e.message.split("\n")[0]}`);
			}
		}
		if (runs.length) add(name, runs);
	};

	// Review: check, Continue (rate + next card), "I don't know"
	{
		const page = await newPage(browser);
		await page.goto(base + "/review", { waitUntil: "load" });
		await page.waitForSelector('[data-testid="review-card"]');
		const chk = [];
		const cont = [];
		for (let i = 0; i < RUNS + 1; i++) {
			await page.waitForSelector('[data-testid="review-card"]');
			await sleep(150);
			const before = await page.$eval('[data-testid="review-card"]', (e) => e.textContent);
			try {
				await page.focus('[data-testid="review-input"]');
				await page.keyboard.type("x");
				chk.push(await act(page, click(page, '[data-testid="review-check"]'), () => !!document.querySelector('[data-testid="review-verdict"]')));
				await sleep(200);
				cont.push(
					await act(
						page,
						click(page, '[data-testid="review-continue"]'),
						(was) => {
							const c = document.querySelector('[data-testid="review-card"]');
							return (!!c && !document.querySelector('[data-testid="review-verdict"]') && c.textContent !== was) || !!document.querySelector('[data-testid="review-done"]');
						},
						before,
					),
				);
			} catch (e) {
				console.error(`  ! review: ${e.message.split("\n")[0]}`);
				break;
			}
		}
		chk.shift();
		cont.shift();
		if (chk.length) add("Review: Check", chk);
		if (cont.length) add("Review: Continue (next card shown)", cont);
		await page.close();
	}

	// Sidebar collapse toggle, settings open/close
	{
		const page = await newPage(browser);
		await page.goto(base + "/", { waitUntil: "load" });
		await sleep(600);
		await safe("Settings: open", async () => {
			await page.waitForSelector('[data-testid="settings-entry"]');
			const r = await act(page, click(page, '[data-testid="settings-entry"]'), () => !!document.querySelector('[data-testid="settings-dialog"]'));
			await sleep(300);
			await page.click('[data-testid="settings-close"]').catch(() => page.keyboard.press("Escape"));
			await page.waitForSelector('[data-testid="settings-dialog"]', { hidden: true }).catch(() => {});
			await sleep(300);
			return r;
		});
		await safe("Settings: switch section", async () => {
			await page.click('[data-testid="settings-entry"]');
			await page.waitForSelector('[data-testid="settings-nav"]');
			await sleep(400);
			const ids = await page.$$eval('[data-testid^="settings-nav-"]', (els) => els.map((e) => e.getAttribute("data-testid")));
			const target = ids[1] ?? ids[0];
			const r = await act(page, click(page, `[data-testid="${target}"]`), () => true);
			await page.keyboard.press("Escape");
			await sleep(300);
			return r;
		});
		await page.close();
	}

	// Lesson: answer + Continue, via Today's Start
	{
		const page = await newPage(browser);
		const lessons = [];
		const conts = [];
		for (let i = 0; i < RUNS; i++) {
			await page.goto(base + "/lesson?unit=words", { waitUntil: "load" });
			try {
				await page.waitForSelector('[data-testid="lesson-options"], [data-testid="lesson-input"]', { timeout: 8000 });
			} catch {
				console.error("  ! lesson: no rep appeared");
				break;
			}
			await sleep(700);
			try {
				if (await page.$('[data-testid="lesson-options"]')) {
					lessons.push(
						await act(page, async () => {
							const b = await page.$('[data-testid="lesson-options"] button');
							await b.click();
						}, () => !!document.querySelector('[data-testid="lesson-feedback"], [data-testid="lesson-hint"], [data-testid="lesson-peek"]')),
					);
				} else {
					await page.focus('[data-testid="lesson-input"]');
					await page.keyboard.type("x");
					lessons.push(await act(page, click(page, '[data-testid="lesson-check"]'), () => !!document.querySelector('[data-testid="lesson-feedback"], [data-testid="lesson-hint"], [data-testid="lesson-peek"]')));
				}
				await sleep(250);
				// A first miss gives a second try instead of feedback; Continue is timed when feedback is up.
				if (await page.$('[data-testid="lesson-continue"]')) conts.push(await act(page, click(page, '[data-testid="lesson-continue"]'), () => !document.querySelector('[data-testid="lesson-feedback"]')));
			} catch (e) {
				console.error(`  ! lesson: ${e.message.split("\n")[0]}`);
			}
		}
		if (lessons.length) add("Lesson: answer", lessons);
		if (conts.length) add("Lesson: Continue", conts);
		await page.close();
	}

	// Today: Start buttons
	{
		const page = await newPage(browser);
		await safe("Today: Start (first rep shown)", async () => {
			await page.goto(base + "/", { waitUntil: "load" });
			await sleep(600);
			const sel = (await page.$('[data-next="true"]')) ? '[data-next="true"]' : null;
			if (!sel) throw new Error("no Start button on Today");
			return act(page, click(page, sel), () => location.pathname !== "/" && !document.querySelector('[aria-busy="true"]') && document.body.innerText.length > 40);
		});
		await page.close();
	}
	return out;
}

function table(rows, head) {
	const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
	const line = (r) => r.map((c, i) => (i === 0 ? String(c).padEnd(w[i]) : String(c).padStart(w[i]))).join("  ");
	return [line(head), w.map((x) => "-".repeat(x)).join("  "), ...rows.map(line)].join("\n");
}

async function main() {
	const puppeteer = loadPuppeteer();
	const srv = await startServer();
	console.log(`CPU x${CPU}; production build on ${srv.base}, scratch data ${srv.dir} (seeded demo week${flag("--light") ? "" : " + a year of reviews"})`);
	const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ["--no-sandbox", "--no-first-run", "--disable-extensions", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
	const result = { navs: [], colds: [], acts: [] };
	try {
		// warm the server so first-compile of a route is not counted against it
		const warm = await newPage(browser);
		for (const r of ROUTES) await warm.goto(srv.base + r.path, { waitUntil: "load" }).catch(() => {});
		await warm.close();

		for (const r of ROUTES) {
			const cs = [];
			for (let i = 0; i < RUNS; i++) cs.push(await cold(browser, srv.base, r));
			result.colds.push({
				route: r.path,
				ttfb: median(cs.map((c) => c.ttfb)),
				fcp: median(cs.map((c) => c.fcp)),
				load: median(cs.map((c) => c.load)),
				stable: median(cs.map((c) => c.stable)),
				jsKb: median(cs.map((c) => c.jsBytes / 1024)),
				longN: median(cs.map((c) => c.long.length)),
				longMs: median(cs.map((c) => c.long.reduce((a, l) => a + l.d, 0))),
				api: cs[cs.length - 1].api,
			});
		}
		const navPage = await newPage(browser);
		for (const r of ROUTES.filter((x) => x.door)) {
			const ns = [];
			for (let i = 0; i < RUNS; i++) {
				try {
					ns.push(await navClick(navPage, srv.base, r.path === "/" ? "/curriculum" : "/", r));
				} catch (e) {
					console.error(`  ! nav ${r.name}: ${e.message.split("\n")[0]}`);
				}
			}
			if (ns.length) result.navs.push({ route: r.name, url: median(ns.map((n) => n.url)), stable: median(ns.map((n) => n.stable)), paint: median(ns.map((n) => n.paint)) });
		}
		await navPage.close();
		result.acts = await interactions(browser, srv.base);
	} finally {
		await browser.close().catch(() => {});
		srv.stop();
	}

	console.log(`\nSidebar click -> new page (ms, median of ${RUNS})`);
	console.log(table(result.navs.map((n) => [n.route, r0(n.paint), r0(n.url), r0(n.stable)]), ["route", "click->paint", "click->url", "click->stable"]));
	console.log(`\nFull page load (ms, median of ${RUNS}; jsKb = JS the route downloads, encoded)`);
	console.log(table(result.colds.map((c) => [c.route, r0(c.ttfb), r0(c.fcp), r0(c.load), r0(c.stable), r0(c.jsKb), `${r0(c.longN)}/${r0(c.longMs)}`, c.api.length]), ["route", "ttfb", "fcp", "load", "stable", "jsKb", "long n/ms", "api"]));
	console.log("\nAPI waterfall on load (start = ms after navigation start, dur = start -> end)");
	for (const c of result.colds) {
		if (!c.api.length) continue;
		console.log(`  ${c.route}`);
		for (const a of c.api) console.log(`    ${r0(a.start).padStart(5)} +${r0(a.dur).padStart(4)}  ${a.url}`);
	}
	console.log(`\nInteractions (ms, median of ${RUNS}; paint = pointerdown -> next frame, done = result on screen)`);
	console.log(table(result.acts.map((a) => [a.name, r0(a.paint), r0(a.done), a.n]), ["interaction", "paint", "done", "n"]));

	const bad = [];
	const over = (what, v, lim) => v != null && v > lim && bad.push(`${what}: ${r0(v)} > ${lim}`);
	for (const n of result.navs) {
		over(`nav ${n.route} click->url`, n.url, BUDGETS.navUrlMs);
		over(`nav ${n.route} click->stable`, n.stable, BUDGETS.navStableMs);
	}
	for (const c of result.colds) {
		over(`load ${c.route}`, c.stable, BUDGETS.coldLoadMs);
		over(`longtasks ${c.route}`, c.longMs, BUDGETS.longTaskTotalMs);
		over(`js ${c.route} kB`, c.jsKb, BUDGETS.jsKbPerRoute);
		for (const a of c.api) over(`api ${c.route} ${a.url}`, a.dur, BUDGETS.apiMs);
	}
	for (const a of result.acts) {
		over(`act ${a.name} paint`, a.paint, BUDGETS.actPaintMs);
		over(`act ${a.name} done`, a.done, BUDGETS.actDoneMs);
	}
	if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, ...result }, null, 2));
	if (bad.length) {
		console.log(`\n${bad.length} budget${bad.length === 1 ? "" : "s"} broken:\n  ${bad.join("\n  ")}`);
		if (CHECK) process.exit(1);
	} else console.log("\nAll budgets held.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
