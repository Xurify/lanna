import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const options = {
	themes: ["day", "night"],
	widths: [1280, 390],
	chrome: process.env.CHROME_PATH,
	height: 0,
	reducedMotion: false,
	click: "",
};
const positional = [];
for (let i = 0; i < args.length; i += 1) {
	const arg = args[i];
	if (arg === "--themes") options.themes = (args[++i] ?? "").split(",");
	else if (arg === "--widths") options.widths = (args[++i] ?? "").split(",").map(Number);
	else if (arg === "--chrome") options.chrome = args[++i];
	else if (arg === "--height") options.height = Number(args[++i]);
	else if (arg === "--reduced-motion") options.reducedMotion = true;
	else if (arg === "--click") options.click = args[++i] ?? "";
	else positional.push(arg);
}

const [baseUrl, outDir, ...shots] = positional;
if (!baseUrl || !outDir || shots.length === 0) {
	console.error(
		"usage: node scripts/pr-shots.mjs <baseUrl> <outDir> <name=/route[@css selector]>... [--themes day,night] [--widths 1280,390] [--chrome path] [--height px] [--reduced-motion] [--click css selector]",
	);
	process.exit(1);
}

const candidates = [
	options.chrome,
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) {
	console.error("no Chrome found: pass --chrome <path> or set CHROME_PATH");
	process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
if (options.reducedMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
const written = [];

for (const shot of shots) {
	const separator = shot.indexOf("=");
	const name = shot.slice(0, separator);
	const target = shot.slice(separator + 1);
	const [route, selector] = target.split("@");
	if (/^[A-Za-z]:[/]/.test(route))
		throw new Error(`${name}: Git Bash rewrote the route to ${route}; set MSYS_NO_PATHCONV=1`);
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
			await page.setCookie(
				{ name: "lanna-theme", value: theme, url: baseUrl },
				{ name: "lanna-language", value: "slovak", url: baseUrl },
			);
			await page.goto(new URL(route || "/", baseUrl).href, { waitUntil: "load", timeout: 90000 });
			await page.evaluate((value) => {
				const root = document.documentElement;
				root.dataset.theme = value;
				root.classList.toggle("dark", value === "night");
			}, theme);
			await new Promise((resolve) => setTimeout(resolve, 900));
			if (options.click) {
				await page.click(options.click);
				await new Promise((resolve) => setTimeout(resolve, 900));
			}
			const file = path.join(outDir, `${name}-${theme}-${width}.png`);
			const element = selector ? await page.$(selector) : null;
			if (selector && !element) throw new Error(`${name}: nothing matches ${selector}`);
			await (element ?? page).screenshot({ path: file });
			written.push(file);
		}
	}
}

await browser.close();
console.log(written.join("\n"));
