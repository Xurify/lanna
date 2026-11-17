import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Slider } from "@/components/ui/slider";

test("Slider renders stops starting at 0 with notches, segment labels, and active highlight", () => {
	const stops = [
		{ value: 0, label: "0" },
		{ value: 200, label: "200" },
		{ value: 500, label: "500" },
		{ value: 1000, label: "1,000" },
		{ value: 2000, label: "2,000" },
		{ value: 7105, label: "All" },
	];

	const html = renderToStaticMarkup(
		<Slider header label="Most common" value={0} onChange={() => {}} stops={stops} valueText="0 words" />,
	);

	// Check ARIA attributes
	assert.match(html, /role="slider"/);
	assert.match(html, /aria-valuenow="0"/);
	assert.match(html, /aria-valuemin="0"/);
	assert.match(html, /aria-valuemax="7105"/);
	assert.match(html, /aria-valuetext="0 words"/);

	// Check stop labels rendered
	assert.match(html, />0<\/button>/);
	assert.match(html, />200<\/button>/);
	assert.match(html, />500<\/button>/);
	assert.match(html, />1,000<\/button>/);
	assert.match(html, />2,000<\/button>/);
	assert.match(html, />All<\/button>/);

	// Check stop 0 has font-semibold text-foreground
	assert.match(html, /font-semibold text-foreground[^>]*>0<\/button>/);
});

test("Slider supports free values between stops with smooth interpolation", () => {
	const stops = [
		{ value: 0, label: "0" },
		{ value: 200, label: "200" },
		{ value: 500, label: "500" },
		{ value: 1000, label: "1,000" },
		{ value: 2000, label: "2,000" },
		{ value: 7105, label: "All" },
	];

	// Value 350 is midway between 200 (20%) and 500 (40%) -> share = 30%
	const html = renderToStaticMarkup(
		<Slider header label="Most common" value={350} onChange={() => {}} stops={stops} valueText="Top 350 of 7,105" />,
	);

	assert.match(html, /aria-valuenow="350"/);
	assert.match(html, /aria-valuetext="Top 350 of 7,105"/);
	// Fill bar at 30%
	assert.match(html, /width:\s*30%/);
	// Thumb at 30%
	assert.match(html, /left:\s*30%/);
	// No button should have font-semibold since 350 is between stops
	assert.doesNotMatch(html, /font-semibold text-foreground[^>]*>[^<]*<\/button>/);
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
