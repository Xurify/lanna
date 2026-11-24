// Chrome splits a line box's leading unevenly when line-height × font-size is fractional, so a label
// beside an icon in an `items-center` row sits up to 1px above the icon's center. This walks every
// route and fails when an icon's center is more than --limit px from the cap-height center of the
// text beside it.
//
//   node scripts/icon-align-check.mjs <baseUrl> [--limit 0.5] [--routes /,/review] [--chrome path]

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

export function measureIconRows() {
	const canvas = document.createElement("canvas").getContext("2d");
	const capHeightOf = (style) => {
		canvas.font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
		return (canvas.measureText("H").actualBoundingBoxAscent / 100) * parseFloat(style.fontSize);
	};
	const shown = (el) => {
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0 && el.checkVisibility({ visibilityProperty: true });
	};
	const iconOf = (node) => {
		if (node.nodeType !== Node.ELEMENT_NODE) return null;
		if (node.localName === "svg") return node;
		const only = node.children.length === 1 && !node.textContent.trim() ? node.firstElementChild : null;
		return only?.localName === "svg" ? only : null;
	};
	const centersItsOwnText = (el) => {
		const style = getComputedStyle(el);
		return style.position === "absolute" || style.position === "fixed" || /flex|grid/.test(style.display);
	};
	const labelTextOf = (node) => {
		if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() ? node : null;
		if (node.nodeType !== Node.ELEMENT_NODE || node.childNodes.length !== 1) return null;
		const text = node.firstChild;
		if (text.nodeType !== Node.TEXT_NODE || !text.textContent.trim()) return null;
		return shown(node) && !centersItsOwnText(node) ? text : null;
	};
	const rangeOf = (text) => {
		const range = document.createRange();
		range.selectNodeContents(text);
		return range;
	};
	const besideEachOther = (icon, text) => {
		const a = icon.getBoundingClientRect();
		const b = rangeOf(text).getBoundingClientRect();
		return Math.max(b.left - a.right, a.left - b.right) <= 16;
	};
	const onOneLine = (text) => rangeOf(text).getClientRects().length === 1;
	const baselineOf = (text) => {
		const marker = document.createElement("span");
		marker.style.cssText = "display:inline-block;width:0;height:0";
		const parent = text.parentNode;
		if (getComputedStyle(parent).display.includes("flex")) {
			const holder = document.createElement("span");
			parent.insertBefore(holder, text);
			holder.append(text, marker);
			const baseline = marker.getBoundingClientRect().bottom;
			parent.insertBefore(text, holder);
			holder.remove();
			return baseline;
		}
		parent.insertBefore(marker, text.nextSibling);
		const baseline = marker.getBoundingClientRect().bottom;
		marker.remove();
		return baseline;
	};
	const name = (el) => {
		const id = el.getAttribute("data-testid") || el.getAttribute("aria-label");
		const words = el.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
		return `${el.localName}${id ? `[${id}]` : ""} "${words}"`;
	};
	const rows = [];
	for (const row of document.querySelectorAll("body *")) {
		const style = getComputedStyle(row);
		if (!style.display.includes("flex") || style.flexDirection.startsWith("column")) continue;
		if (!style.alignItems.endsWith("center") || !shown(row)) continue;
		const children = [...row.childNodes];
		const icons = children.map(iconOf).filter((icon) => icon && shown(icon));
		const texts = children.map(labelTextOf).filter((text) => text && onOneLine(text));
		for (const icon of icons) {
			const text = texts.find((candidate) => besideEachOther(icon, candidate));
			if (!text) continue;
			const capCenter = baselineOf(text) - capHeightOf(getComputedStyle(text.parentNode)) / 2;
			const rect = icon.getBoundingClientRect();
			rows.push({ row: name(row), offset: Math.round(((rect.top + rect.bottom) / 2 - capCenter) * 100) / 100 });
		}
	}
	for (const label of document.querySelectorAll(".cap-center")) {
		if (shown(label) && getComputedStyle(label).overflowY !== "visible")
			rows.push({
				row: `${name(label)} clips its letters: a cap-center label needs overflow-y visible`,
				offset: Infinity,
			});
	}
	return rows;
}

async function main() {
	const args = process.argv.slice(2);
	const option = (name, fallback) => {
		const index = args.indexOf(`--${name}`);
		return index >= 0 ? args[index + 1] : fallback;
	};
	const baseUrl = args.find((arg) => /^https?:/.test(arg));
	if (!baseUrl) {
		console.error(
			"usage: node scripts/icon-align-check.mjs <baseUrl> [--limit 0.5] [--routes /,/review] [--chrome path]",
		);
		process.exit(1);
	}
	const limit = Number(option("limit", "0.5"));
	const routes = option(
		"routes",
		"/,/review,/listen,/read,/speak,/watch,/speed?mode=fast,/mistakes,/grammar,/curriculum,/milestones,/progress,/words,/map,/chat/new,/log,/lesson,/start,/nowhere",
	).split(",");
	const executablePath = [
		option("chrome", process.env.CHROME_PATH),
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
	]
		.filter(Boolean)
		.find((candidate) => fs.existsSync(candidate));
	if (!executablePath) {
		console.error("no Chrome found: pass --chrome <path> or set CHROME_PATH");
		process.exit(1);
	}

	const browser = await puppeteer.launch({ executablePath, headless: true });
	const page = await browser.newPage();
	const misses = new Map();
	let measured = 0;
	const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	const record = async (where, width) => {
		for (const { row, offset } of await page.evaluate(measureIconRows)) {
			measured += 1;
			if (Math.abs(offset) <= limit) continue;
			const key = `${where} ${row}`;
			if (!misses.has(key) || Math.abs(offset) > Math.abs(misses.get(key).offset))
				misses.set(key, { where, width, row, offset });
		}
	};
	const tryState = async (where, width, steps) => {
		try {
			await steps();
			await record(where, width);
		} catch (error) {
			misses.set(`${where} failed`, {
				where,
				width,
				row: `could not open: ${String(error.message).slice(0, 80)}`,
				offset: NaN,
			});
		}
	};

	for (const width of [1280, 390]) {
		const isMobile = width < 600;
		await page.setViewport({ width, height: isMobile ? 844 : 860, isMobile, hasTouch: isMobile });
		for (const route of routes)
			await tryState(route, width, async () => {
				await page.goto(new URL(route, baseUrl).href, { waitUntil: "load", timeout: 90000 });
				await pause(1200);
			});
	}

	await page.setViewport({ width: 1280, height: 860 });
	await page.goto(new URL("/", baseUrl).href, { waitUntil: "load", timeout: 90000 });
	await pause(1200);
	await tryState("settings", 1280, async () => {
		await page.click('[data-testid="settings-entry"]');
		await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
		await pause(600);
	});
	for (let tab = 0; ; tab += 1) {
		const tabs = await page.$$('[role="dialog"] [role="tab"]');
		if (tab >= tabs.length) break;
		const label = await tabs[tab].evaluate((element) => element.textContent.trim());
		await tryState(`settings: ${label}`, 1280, async () => {
			await tabs[tab].click();
			await pause(500);
		});
	}
	await page.goto(new URL("/", baseUrl).href, { waitUntil: "load", timeout: 90000 });
	await pause(1200);
	await tryState("notifications", 1280, async () => {
		await page.click('[data-testid="notifications-entry"]');
		await page.waitForSelector('[data-testid="notifications-dialog"]', { timeout: 8000 });
		await pause(600);
	});
	if (await page.$('[data-testid="session-row"]')) {
		await page.goto(new URL("/", baseUrl).href, { waitUntil: "load", timeout: 90000 });
		await pause(1200);
		await tryState("chat menu", 1280, async () => {
			await page.click('[data-testid="session-row"]', { button: "right" });
			await page.waitForSelector('[data-testid="ctx-delete"]', { timeout: 8000 });
		});
		await tryState("delete-chat dialog", 1280, async () => {
			await page.click('[data-testid="ctx-delete"]');
			await page.waitForSelector('[data-testid="delete-session-dialog"]', { timeout: 8000 });
			await pause(400);
		});
	}
	await browser.close();

	for (const { where, width, row, offset } of misses.values())
		console.log(`${String(offset).padStart(6)}px  ${where.padEnd(18)} ${width}  ${row}`);
	console.log(
		misses.size
			? `\n${misses.size} icon rows off by more than ${limit}px (positive: icon below the text) of ${measured} measured`
			: `\nAll ${measured} icon rows within ${limit}px`,
	);
	process.exit(misses.size ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
