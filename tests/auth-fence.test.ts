/**
 * The auth file under the test fence (2026-11-06): a test run that does not
 * set LH_AUTH_FILE must never resolve the repo-root auth.json, where the
 * learner's keys live in dev. And an unknown var held in the file (a stray
 * fixture such as "B": "2") can be deleted through DELETE /api/keys/:id,
 * while an unknown id that is not in the file stays a 404.
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

delete process.env.LH_AUTH_FILE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-auth-fence-"));
process.env.LH_DATA_DIR = TMP;

const { AUTH_FILE, ROOT } = await import("../config.ts");
const { authStore } = await import("../src/store/auth.ts");
const route = await import("../app/api/keys/[id]/route.ts");

after(() => {
	fs.rmSync(TMP, { recursive: true, force: true });
});

const call = (id: string) => route.DELETE(new Request(`http://localhost/api/keys/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

describe("auth file test fence", () => {
	it("resolves inside the test data folder, never the repo-root auth.json", () => {
		assert.notEqual(AUTH_FILE, path.join(ROOT, "auth.json"));
		assert.equal(AUTH_FILE, path.join(TMP, "auth.json"));
	});

	it("an unknown var in the file can be deleted; the others stay", async () => {
		fs.writeFileSync(AUTH_FILE, JSON.stringify({ B: "2", KEEP_ME: "x" }));
		const res = await call("B");
		assert.equal(res.status, 200);
		assert.deepEqual(authStore.authVars(), { KEEP_ME: "x" });
	});

	it("an unknown id that is not in the file is still a 404", async () => {
		const res = await call("NOT_IN_THE_FILE");
		assert.equal(res.status, 404);
	});
});
