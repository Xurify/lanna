/**
 * Tab cycles a surface's text fields forward and wraps (components/field-cycle.ts).
 * The fields are stand-ins: nextField only asks each one whether it contains the
 * active element, so no DOM is needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextField } from "../components/field-cycle.ts";

function field(name: string, inside: string[] = []): HTMLElement {
	const el = {
		name,
		contains: (other: unknown) => inside.some((n) => (other as { name?: string } | null)?.name === n),
	};
	return el as unknown as HTMLElement;
}

describe("nextField (Tab on a surface with text fields)", () => {
	const [a, b, c] = [field("a"), field("b"), field("c")];

	it("from outside the chain, focuses the first field", () => {
		assert.equal(nextField([a, b, c], null), a);
	});

	it("moves to the next field in order", () => {
		assert.equal(nextField([a, b, c], a as unknown as Element), b);
		assert.equal(nextField([a, b, c], b as unknown as Element), c);
	});

	it("wraps from the last field back to the first", () => {
		assert.equal(nextField([a, b, c], c as unknown as Element), a);
	});

	it("an element inside a field moves on from that field", () => {
		const nested = field("nested-in-b");
		const withNested = field("b-box", ["nested-in-b"]);
		assert.equal(nextField([a, withNested, c], nested as unknown as Element), c);
	});

	it("a focused element that is not in the chain focuses the first field", () => {
		assert.equal(nextField([a, b], field("elsewhere") as unknown as Element), a);
	});

	it("an empty chain has no next field", () => {
		assert.equal(nextField([], null), undefined);
	});
});
