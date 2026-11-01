import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CountryFlag, langToCountryCode } from "../components/ui/country-flag.tsx";

describe("CountryFlag & langToCountryCode", () => {
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
	});

	it("renders crisp SVG flag with country code dataset and role=img", () => {
		const slovakMarkup = renderToStaticMarkup(<CountryFlag lang="slovak" className="w-4.5 h-3.5" />);
		assert.ok(slovakMarkup.includes('data-country-code="SK"'));
		assert.ok(slovakMarkup.includes('role="img"'));
		assert.ok(slovakMarkup.includes("<svg"));
		assert.ok(slovakMarkup.includes("#0b4ea2")); // Slovak blue

		const russianMarkup = renderToStaticMarkup(<CountryFlag lang="russian" className="w-4.5 h-3.5" />);
		assert.ok(russianMarkup.includes('data-country-code="RU"'));
		assert.ok(russianMarkup.includes('role="img"'));
		assert.ok(russianMarkup.includes("<svg"));
		assert.ok(russianMarkup.includes("#0039a6")); // Russian blue
	});

	it("respects direct code prop over lang prop", () => {
		const markup = renderToStaticMarkup(<CountryFlag lang="slovak" code="DE" />);
		assert.ok(markup.includes('data-country-code="DE"'));
		assert.ok(markup.includes("#ffce00")); // German gold
	});
});
