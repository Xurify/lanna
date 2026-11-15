import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeMenuPlacement } from "../components/menu-shell.tsx";

const phone = { width: 390, height: 844 };
const trigger = (left: number, right: number) => ({ top: 300, bottom: 332, left, right });

describe("computeMenuPlacement horizontal edges", () => {
	it("keeps a right-aligned menu inside the left edge on a phone", () => {
		// Trigger at the left of a 390px screen; a 352px menu would start at -187px without the clamp.
		const p = computeMenuPlacement(trigger(32, 165), phone, 400, 352, "down", "right");
		assert.equal(p.style.right, 30);
		assert.ok(phone.width - (p.style.right as number) - 352 >= 8);
	});

	it("keeps the usual right-aligned placement when the menu fits", () => {
		const p = computeMenuPlacement(trigger(300, 380), phone, 400, 352, "down", "right");
		assert.equal(p.style.right, 10);
	});

	it("keeps a left-aligned menu inside the right edge", () => {
		const p = computeMenuPlacement(trigger(300, 380), phone, 400, 352, "down", "left");
		assert.equal(p.style.left, 30);
	});
});
