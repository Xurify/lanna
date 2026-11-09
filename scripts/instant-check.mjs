/**
 * Instant check: is the next page on screen before the server answers?
 *
 *   npm run build
 *   node scripts/instant-check.mjs            # every sidebar row, print the table
 *   node scripts/instant-check.mjs --check    # exit 1 when a row shows less than it should
 *   node scripts/instant-check.mjs --dev      # against `next dev` instead of the build
 *   node scripts/instant-check.mjs --rest 400 # ms the pointer rests on a row before the press (default 300)
 *   node scripts/instant-check.mjs --press 90 # ms the mouse button stays down (default 90)
 *   node scripts/instant-check.mjs --cpu 4    # emulate a CPU four times slower
 *   node scripts/instant-check.mjs --only /review  # one row
 *
 * For each row: rest the pointer on it, then hold every request the page makes,
 * click (button down, a moment, button up) and look at what is on screen while the
 * server cannot answer. The time is from the button going down. This is what `instant()` from @next/playwright does for a Cache
 * Components app (https://nextjs.org/docs/app/guides/instant-navigation); this app
 * renders every page per request, so the check is its own.
 *
 *   page     the page itself is up: it was rendered while the pointer rested on the row
 *   shell    the URL changed and loading.tsx shows; the page waits for the server
 *   blocked  nothing changed until the server answered
 *
 * A row in SHELL_ONLY is a page whose render starts paid or network work
 * (`rendersAhead` in lib/nav.ts is left off), so "shell" is the most it may show.
 */

import { BROWSER_ARGS, findBrowser, loadPuppeteer, sleep, startServer, table } from "./perf-harness.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const CHECK = flag("--check");
const DEV = flag("--dev");
const REST_MS = Number(opt("--rest", "300"));
const PRESS_MS = Number(opt("--press", "90"));
const CPU = Number(opt("--cpu", "1"));
const ONLY = opt("--only", "");
const HELD_FOR_MS = 1200;

const SHELL_ONLY = new Set(["/read", "/listen", "/watch", "/experiments/input-first"]);
const RANK = { blocked: 0, shell: 1, page: 2 };

/** Wait until the DOM has not changed for `ms`, or for `atMost` on a page that never rests (a running timer). */
const quiet = (page, ms = 250, atMost = 4000) =>
	page.evaluate(
		(q, cap) =>
			new Promise((res) => {
				const from = performance.now();
				let last = from;
				const seen = new MutationObserver(() => (last = performance.now()));
				seen.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
				const tick = () => (performance.now() - last >= q || performance.now() - from >= cap ? (seen.disconnect(), res()) : setTimeout(tick, 25));
				tick();
			}),
		ms,
		atMost,
	);

/** What is on screen `heldFor` ms after the press, and when it got there. Runs in the page, and is in place before the press is sent. */
const WATCH_PRESS = (want, heldFor) => {
	window.__pressSeen = new Promise((res) => {
		addEventListener(
			"pointerdown",
			(e) => {
				const pressedAt = e.timeStamp;
				let shellAt = null;
				const look = () => {
					const now = performance.now();
					const arrived = location.pathname === want;
					const loading = !!document.querySelector('[data-testid="route-loading"]');
					if (arrived && !loading) return res({ shows: "page", ms: now - pressedAt });
					if (arrived && shellAt === null) shellAt = now;
					if (now - pressedAt > heldFor) return res(shellAt === null ? { shows: "blocked", ms: null } : { shows: "shell", ms: shellAt - pressedAt });
					setTimeout(look, 4);
				};
				look();
			},
			{ capture: true, once: true },
		);
	});
};

async function press(page, base, from, door) {
	await page.goto(base + from, { waitUntil: "load" });
	await sleep(400);
	await quiet(page);
	const sel = `[data-testid="${door.testid}"]`;
	await page.hover(sel);
	await sleep(REST_MS);

	const held = [];
	const hold = (req) => held.push(req);
	await page.setRequestInterception(true);
	page.on("request", hold);
	try {
		await page.evaluate(WATCH_PRESS, door.path, HELD_FOR_MS);
		await page.mouse.down();
		await sleep(PRESS_MS);
		await page.mouse.up();
		return await page.evaluate(() => window.__pressSeen);
	} finally {
		page.off("request", hold);
		await Promise.all(held.map((r) => r.continue().catch(() => {})));
		await page.setRequestInterception(false);
		await quiet(page);
	}
}

async function main() {
	const puppeteer = loadPuppeteer();
	const srv = await startServer({ heavy: false, dev: DEV });
	console.log(`CPU x${CPU}; ${DEV ? "next dev" : "production build"} on ${srv.base}, scratch data ${srv.dir}; the pointer rests ${REST_MS} ms on a row, the button is down ${PRESS_MS} ms`);
	const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: BROWSER_ARGS });
	const rows = [];
	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 });
		if (CPU > 1) await (await page.createCDPSession()).send("Emulation.setCPUThrottlingRate", { rate: CPU });
		await page.goto(srv.base + "/", { waitUntil: "load" });
		await page.waitForSelector('nav[aria-label="Main"] a[data-testid$="-door"]');
		const doors = await page.$$eval('nav[aria-label="Main"] a[data-testid$="-door"]', (as) => as.map((a) => ({ testid: a.dataset.testid, path: a.pathname, label: a.textContent.trim().replace(/\s*\d+( new)?$/, "") })));
		// `next dev` compiles a route the first time it is asked for; that wait is not what this measures.
		if (DEV) for (const d of doors) await page.goto(srv.base + d.path, { waitUntil: "load" }).catch(() => {});
		for (const door of doors.filter((d) => !ONLY || d.path === ONLY)) {
			const wants = SHELL_ONLY.has(door.path) ? "shell" : "page";
			try {
				const r = await press(page, srv.base, door.path === "/" ? "/curriculum" : "/", door);
				rows.push({ door, wants, ...r });
			} catch (e) {
				rows.push({ door, wants, shows: "blocked", ms: null, error: e.message.split("\n")[0] });
			}
		}
	} finally {
		await browser.close().catch(() => {});
		srv.stop();
	}

	console.log("\nClick a sidebar row with the server held (ms from the button going down)");
	console.log(table(rows.map((r) => [r.door.label, r.door.path, r.shows, r.ms == null ? "-" : String(Math.round(r.ms)), r.wants, RANK[r.shows] >= RANK[r.wants] ? "ok" : "LESS"]), ["row", "path", "on screen", "ms", "should show", ""]));
	for (const r of rows) if (r.error) console.log(`  ! ${r.door.label}: ${r.error}`);
	const less = rows.filter((r) => RANK[r.shows] < RANK[r.wants]);
	const more = rows.filter((r) => RANK[r.shows] > RANK[r.wants]);
	if (more.length) console.log(`\nRendered ahead though its render is not free: ${more.map((r) => r.door.label).join(", ")}`);
	if (less.length || more.length) {
		console.log(`\n${less.length} row${less.length === 1 ? "" : "s"} show less than they should, ${more.length} more.`);
		if (CHECK) process.exit(1);
	} else console.log("\nEvery row shows what it should.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
