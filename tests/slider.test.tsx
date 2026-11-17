import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Slider } from "@/components/ui/slider";

test("Slider renders stops with notches, segment labels, and active highlight", () => {
	const stops = [
		{ value: 200, label: "200" },
		{ value: 500, label: "500" },
		{ value: 1000, label: "1,000" },
		{ value: 2000, label: "2,000" },
		{ value: 7105, label: "All" },
	];

	const html = renderToStaticMarkup(
		<Slider header label="Most common" value={500} onChange={() => {}} stops={stops} valueText="Top 500 of 7,105" />,
	);

	// Check ARIA attributes
	assert.match(html, /role="slider"/);
	assert.match(html, /aria-valuenow="500"/);
	assert.match(html, /aria-valuemin="200"/);
	assert.match(html, /aria-valuemax="7105"/);
	assert.match(html, /aria-valuetext="Top 500 of 7,105"/);

	// Check stop labels rendered
	assert.match(html, />200<\/button>/);
	assert.match(html, />500<\/button>/);
	assert.match(html, />1,000<\/button>/);
	assert.match(html, />2,000<\/button>/);
	assert.match(html, />All<\/button>/);

	// Check active stop has font-semibold text-foreground
	assert.match(html, /font-semibold text-foreground[^>]*>500<\/button>/);
});

test("Slider without stops retains standard continuous slider behavior", () => {
	const html = renderToStaticMarkup(
		<Slider header label="Continuous" value={0.5} onChange={() => {}} min={0} max={1} step={0.1} />,
	);

	assert.match(html, /aria-valuenow="50"/);
	assert.match(html, /aria-valuemin="0"/);
	assert.match(html, /aria-valuemax="100"/);
	// No segment buttons should be present
	assert.doesNotMatch(html, /<button/);
});
