import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CountryFlag, langToCountryCode, loadFlags } from "../components/ui/country-flag.tsx";

describe("CountryFlag & langToCountryCode", () => {
	// The flag set loads on first use, and renderToStaticMarkup never runs the effect that starts it.
	before(() => loadFlags());

	it("maps language identifiers and BCP-47 tags to correct ISO-2 country codes", () => {
		assert.equal(langToCountryCode("slovak"), "SK");
		assert.equal(langToCountryCode("sk"), "SK");
		assert.equal(langToCountryCode("sk-SK"), "SK");

		assert.equal(langToCountryCode("russian"), "RU");
		assert.equal(langToCountryCode("ru"), "RU");
		assert.equal(langToCountryCode("ru-RU"), "RU");

		assert.equal(langToCountryCode("english"), "GB");
		assert.equal(langToCountryCode("en"), "GB");

		assert.equal(langToCountryCode("german"), "DE");
		assert.equal(langToCountryCode("de"), "DE");

		assert.equal(langToCountryCode("czech"), "CZ");
		assert.equal(langToCountryCode("cs"), "CZ");

		assert.equal(langToCountryCode("ukrainian"), "UA");
		assert.equal(langToCountryCode("uk"), "UA");

		assert.equal(langToCountryCode("polish"), "PL");
		assert.equal(langToCountryCode("pl"), "PL");

		assert.equal(langToCountryCode("finnish"), "FI");
		assert.equal(langToCountryCode("fi"), "FI");

		assert.equal(langToCountryCode("estonian"), "EE");
		assert.equal(langToCountryCode("et"), "EE");

		// Non-latin languages from user's "More languages" dialog
		assert.equal(langToCountryCode("arabic"), "SA");
		assert.equal(langToCountryCode("ar"), "SA");
		assert.equal(langToCountryCode("hebrew"), "IL");
		assert.equal(langToCountryCode("he"), "IL");
		assert.equal(langToCountryCode("hindi"), "IN");
		assert.equal(langToCountryCode("hi"), "IN");
		assert.equal(langToCountryCode("korean"), "KR");
		assert.equal(langToCountryCode("ko"), "KR");
		assert.equal(langToCountryCode("vietnamese"), "VN");
		assert.equal(langToCountryCode("vi"), "VN");
		assert.equal(langToCountryCode("thai"), "TH");
		assert.equal(langToCountryCode("th"), "TH");
	});

	it("renders crisp SVG flag with country code dataset and role=img", () => {
		const slovakMarkup = renderToStaticMarkup(<CountryFlag lang="slovak" />);
		assert.ok(slovakMarkup.includes('data-country-code="SK"'));
		assert.ok(slovakMarkup.includes('role="img"'));
		assert.ok(slovakMarkup.includes("<svg"));
		assert.ok(slovakMarkup.includes("#0052B4")); // Slovak blue
		assert.ok(slovakMarkup.includes("w-6 h-4")); // bigger size (24x16)
		assert.ok(slovakMarkup.includes("ring-black/10")); // crisp border
		assert.ok(slovakMarkup.includes("dark:ring-white/15")); // dark mode border
		assert.ok(slovakMarkup.includes("shadow-2xs")); // subtle depth

		const russianMarkup = renderToStaticMarkup(<CountryFlag lang="russian" />);
		assert.ok(russianMarkup.includes('data-country-code="RU"'));
		assert.ok(russianMarkup.includes('role="img"'));
		assert.ok(russianMarkup.includes("<svg"));
		assert.ok(russianMarkup.includes("#0039a6")); // Russian blue

		// Arabic renders SA SVG flag, not a text badge
		const arabicMarkup = renderToStaticMarkup(<CountryFlag lang="arabic" />);
		assert.ok(arabicMarkup.includes('data-country-code="SA"'));
		assert.ok(arabicMarkup.includes("<svg"));
		assert.ok(!arabicMarkup.includes(">SA<"));
	});

	it("respects direct code prop over lang prop", () => {
		const markup = renderToStaticMarkup(<CountryFlag lang="slovak" code="DE" />);
		assert.ok(markup.includes('data-country-code="DE"'));
		assert.ok(markup.includes("#FFDA44")); // German gold
	});
});
