import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-acks-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { recordOnce, sessionClientId } = await import("../src/server/session-acks.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

describe("a session sent twice is recorded once (E77)", () => {
	it("answers a second send with the same client id from the first, without recording again", () => {
		let recorded = 0;
		const save = () => ({ xp: ++recorded * 10 });
		const first = recordOnce("listen", "abc12345-retry", save);
		const again = recordOnce("listen", "abc12345-retry", save);
		assert.equal(recorded, 1);
		assert.deepEqual(again, first);
	});

	it("keeps the kinds apart and records a send without an id every time", () => {
		let recorded = 0;
		const save = () => ++recorded;
		recordOnce("read", "abc12345-retry", save);
		recordOnce("watch", "abc12345-retry", save);
		recordOnce("read", undefined, save);
		recordOnce("read", undefined, save);
		assert.equal(recorded, 4);
	});

	it("takes only a plain id from the client", () => {
		assert.equal(sessionClientId("0b7c1e2a-9f3d-4c1b-8a2e-5d6f7a8b9c0d"), "0b7c1e2a-9f3d-4c1b-8a2e-5d6f7a8b9c0d");
		assert.equal(sessionClientId("short"), undefined);
		assert.equal(sessionClientId("../../etc"), undefined);
		assert.equal(sessionClientId(42), undefined);
	});
});
