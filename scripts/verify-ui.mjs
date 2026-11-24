import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { measureIconRows } from "./icon-align-check.mjs";

export function parseVerifyArgs(args) {
	const options = {
		themes: ["day", "night"],
		widths: [1280, 390],
		languages: ["slovak"],
		chrome: process.env.CHROME_PATH,
		height: 0,
		reducedMotion: false,
		expandChapters: false,
		waitFor: "",
		click: "",
		checkIcons: false,
		iconLimit: 0.5,
		ignoreMissingAudio: true,
		asJson: false,
		settleMs: 500,
	};
	const positional = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--themes") options.themes = (args[++index] ?? "").split(",").filter(Boolean);
		else if (arg === "--widths") options.widths = (args[++index] ?? "").split(",").map(Number).filter(Number.isFinite);
		else if (arg === "--languages") options.languages = (args[++index] ?? "").split(",").filter(Boolean);
		else if (arg === "--chrome") options.chrome = args[++index];
		else if (arg === "--height") options.height = Number(args[++index]);
		else if (arg === "--settle-ms") options.settleMs = Number(args[++index]);
		else if (arg === "--reduced-motion") options.reducedMotion = true;
		else if (arg === "--expand-chapters") options.expandChapters = true;
		else if (arg === "--wait-for") options.waitFor = args[++index] ?? "";
		else if (arg === "--click") options.click = args[++index] ?? "";
		else if (arg === "--check-icons") options.checkIcons = true;
		else if (arg === "--icon-limit") options.iconLimit = Number(args[++index]);
		else if (arg === "--fail-on-missing-audio") options.ignoreMissingAudio = false;
		else if (arg === "--json") options.asJson = true;
		else positional.push(arg);
	}
	const [baseUrl, outDir, ...shots] = positional;
	return { baseUrl, outDir, shots, options };
}

export function parseShotSpec(spec) {
	const separator = spec.indexOf("=");
	if (separator <= 0) throw new Error(`Invalid shot spec "${spec}": expected name=/route[@selector]`);
	const name = spec.slice(0, separator);
	const target = spec.slice(separator + 1);
	const atIndex = target.indexOf("@");
	const route = atIndex >= 0 ? target.slice(0, atIndex) : target;
	const selector = atIndex >= 0 ? target.slice(atIndex + 1) : "";
	if (/^[A-Za-z]:[/\\]/.test(route)) {
		throw new Error(`${name}: Git Bash rewrote the route to ${route}; set MSYS_NO_PATHCONV=1`);
	}
	return { name, route: route || "/", selector };
}

export function isIgnoredMissingAudio(text) {
	return /\/api\/audio|NotAllowedError|play\(\) failed|MEDIA_ERR_SRC_NOT_SUPPORTED/i.test(text);
}

function findChrome(override) {
	const candidates = [
		override,
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
	].filter(Boolean);
	return candidates.find((candidate) => fs.existsSync(candidate));
}

async function expandCollapsedChapters(page) {
	await page.evaluate(() => {
		const buttons = document.querySelectorAll('button[aria-expanded="false"]');
		for (const button of buttons) {
			if (button instanceof HTMLElement) button.click();
		}
	});
}

async function main() {
	const { baseUrl, outDir, shots, options } = parseVerifyArgs(process.argv.slice(2));
	if (!baseUrl || !outDir || shots.length === 0) {
		console.error(
			"usage: node scripts/verify-ui.mjs <baseUrl> <outDir> <name=/route[@selector]>... " +
				"[--languages slovak,russian,estonian] [--themes day,night] [--widths 1280,390] " +
				"[--expand-chapters] [--wait-for selector] [--click selector] [--reduced-motion] [--check-icons] [--json]",
		);
		process.exit(1);
	}

	const executablePath = findChrome(options.chrome);
	if (!executablePath) {
		console.error("no Chrome found: pass --chrome <path> or set CHROME_PATH");
		process.exit(1);
	}

	fs.mkdirSync(outDir, { recursive: true });
	const parsedShots = shots.map(parseShotSpec);
	const browser = await puppeteer.launch({ executablePath, headless: true });
	const page = await browser.newPage();

	const written = [];
	const runtimeErrors = [];
	const iconMisses = [];
	let iconRowsMeasured = 0;
	let currentContext = "";

	page.on("pageerror", (error) => {
		runtimeErrors.push({ context: currentContext, kind: "pageerror", message: String(error) });
	});
	page.on("console", (message) => {
		if (message.type() !== "error") return;
		const text = message.text();
		if (options.ignoreMissingAudio && isIgnoredMissingAudio(text)) return;
		runtimeErrors.push({ context: currentContext, kind: "console", message: text });
	});
	page.on("response", (response) => {
		if (response.status() >= 500) {
			runtimeErrors.push({
				context: currentContext,
				kind: "http",
				message: `${response.status()} ${response.url()}`,
			});
		}
	});

	if (options.reducedMotion) {
		await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	}

	const multiLanguage = options.languages.length > 1;

	try {
		for (const language of options.languages) {
			for (const shot of parsedShots) {
				for (const width of options.widths) {
					const isMobile = width < 600;
					await page.setViewport({
						width,
						height: options.height || (isMobile ? 844 : 860),
						deviceScaleFactor: 2,
						isMobile,
						hasTouch: isMobile,
					});
					for (const theme of options.themes) {
						currentContext = `${language}:${shot.name}:${theme}:${width}`;
						await page.setCookie(
							{ name: "lanna-theme", value: theme, url: baseUrl },
							{ name: "lanna-language", value: language, url: baseUrl },
						);
						await page.goto(new URL(shot.route, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 60000 });
						await page.evaluate((themeValue) => {
							const root = document.documentElement;
							root.dataset.theme = themeValue;
							root.classList.toggle("dark", themeValue === "night");
						}, theme);
						if (options.waitFor) {
							await page.waitForSelector(options.waitFor, { timeout: 15000 });
						}
						await new Promise((resolve) => setTimeout(resolve, options.settleMs));
						if (options.expandChapters) {
							await expandCollapsedChapters(page);
							await new Promise((resolve) => setTimeout(resolve, 250));
						}
						if (options.click) {
							await page.waitForSelector(options.click, { timeout: 10000 });
							await page.click(options.click);
							await new Promise((resolve) => setTimeout(resolve, options.settleMs));
						}
						if (options.checkIcons) {
							const rows = await page.evaluate(measureIconRows);
							iconRowsMeasured += rows.length;
							for (const row of rows) {
								if (Math.abs(row.offset) > options.iconLimit) {
									iconMisses.push({ context: currentContext, row: row.row, offset: row.offset });
								}
							}
						}
						const prefix = multiLanguage ? `${shot.name}-${language}` : shot.name;
						const file = path.join(outDir, `${prefix}-${theme}-${width}.png`);
						const element = shot.selector ? await page.$(shot.selector) : null;
						if (shot.selector && !element) {
							throw new Error(`${currentContext}: selector "${shot.selector}" matched nothing`);
						}
						await (element ?? page).screenshot({ path: file });
						written.push(file);
					}
				}
			}
		}
	} finally {
		await browser.close();
	}

	const summary = {
		written,
		runtimeErrors,
		iconRowsMeasured,
		iconMisses,
	};

	if (options.asJson) {
		console.log(JSON.stringify(summary, null, 2));
	} else {
		for (const file of written) console.log(file);
		if (options.checkIcons) {
			console.log(`Icon alignment: ${iconRowsMeasured} measured, ${iconMisses.length} over ${options.iconLimit}px`);
			for (const miss of iconMisses) {
				console.error(`  [${miss.context}] ${miss.offset}px ${miss.row}`);
			}
		}
		if (runtimeErrors.length > 0) {
			console.error(`\n${runtimeErrors.length} runtime error(s):`);
			for (const item of runtimeErrors) {
				console.error(`  [${item.context}] (${item.kind}) ${item.message}`);
			}
		}
	}

	const failed = runtimeErrors.length > 0 || iconMisses.length > 0;
	process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
