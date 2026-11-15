import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelCatalogEntry } from "../src/core/contracts/models.ts";
import { modelName, priceLabel, providerLabel, stampModelLabel } from "../components/model-names.ts";

const haiku = {
	id: "claude-haiku-5-5",
	name: "Claude Haiku 5.5",
	provider: "anthropic",
	cost: { input: 0.1, output: 0.5, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1_000_000,
} as ModelCatalogEntry;

describe("model names for the learner", () => {
	it("a price reads as input then output, always two decimals", () => {
		assert.equal(priceLabel(haiku.cost), "$0.10 in · $0.50 out");
		assert.equal(priceLabel({ input: 10, output: 50, cacheRead: 0, cacheWrite: 0 }), "$10.00 in · $50.00 out");
	});

	it("a provider id reads as its label; an unknown id passes through", () => {
		assert.equal(providerLabel("anthropic"), "Anthropic");
		assert.equal(providerLabel("openrouter"), "OpenRouter");
		assert.equal(providerLabel("made-up"), "made-up");
	});

	it("a model reads by the catalog's name, and by its id when the catalog does not list it", () => {
		assert.equal(modelName([haiku], "anthropic", "claude-haiku-5-5"), "Claude Haiku 5.5");
		assert.equal(modelName([haiku], "openrouter", "claude-haiku-5-5"), "claude-haiku-5-5");
		assert.equal(modelName([], undefined, "claude-haiku-5-5"), "claude-haiku-5-5");
	});

	it("a usage stamp reads as the name and the provider", () => {
		assert.equal(stampModelLabel([haiku], "anthropic:claude-haiku-5-5"), "Claude Haiku 5.5 · Anthropic");
		assert.equal(stampModelLabel([], "openrouter:z-ai/glm-5.3-flash"), "glm-5.3-flash · OpenRouter");
		assert.equal(stampModelLabel([], "z-ai/glm-5.3-flash"), "glm-5.3-flash");
	});
});
