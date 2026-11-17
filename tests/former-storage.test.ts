import { test } from "node:test";
import assert from "node:assert/strict";
import { adoptFormerStorage } from "../components/former-storage";

function memoryStorage(entries: Record<string, string> = {}): Storage {
	const map = new Map(Object.entries(entries));
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => void map.delete(key),
		setItem: (key, value) => void map.set(key, String(value)),
	};
}

test("unsent lessons and sessions move to the new keys and join what is already there", () => {
	const storage = memoryStorage({
		"lh-outbox": JSON.stringify([{ id: "old" }]),
		"lanna-outbox": JSON.stringify([{ id: "new" }]),
		"lh-session-outbox": JSON.stringify([{ id: "s1" }]),
	});
	adoptFormerStorage(storage);
	assert.deepEqual(JSON.parse(storage.getItem("lanna-outbox")!), [{ id: "new" }, { id: "old" }]);
	assert.deepEqual(JSON.parse(storage.getItem("lanna-session-outbox")!), [{ id: "s1" }]);
	assert.equal(storage.getItem("lh-outbox"), null);
	assert.equal(storage.getItem("lh-session-outbox"), null);
});

test("the uploaded reminder sound moves, but never over a newer one", () => {
	const storage = memoryStorage({
		"lh:custom-reminder-sound-data": "data:old",
		"lh:custom-reminder-sound-name": "old.mp3",
		"lanna:custom-reminder-sound-name": "new.mp3",
	});
	adoptFormerStorage(storage);
	assert.equal(storage.getItem("lanna:custom-reminder-sound-data"), "data:old");
	assert.equal(storage.getItem("lanna:custom-reminder-sound-name"), "new.mp3");
	assert.equal(storage.getItem("lh:custom-reminder-sound-data"), null);
});

test("a second run changes nothing", () => {
	const storage = memoryStorage({ "lh-outbox": JSON.stringify([{ id: "a" }]) });
	adoptFormerStorage(storage);
	adoptFormerStorage(storage);
	assert.deepEqual(JSON.parse(storage.getItem("lanna-outbox")!), [{ id: "a" }]);
});

test("full storage keeps the former key for the next try", () => {
	const storage = memoryStorage({ "lh-outbox": JSON.stringify([{ id: "a" }]) });
	storage.setItem = () => {
		throw new Error("QuotaExceededError");
	};
	adoptFormerStorage(storage);
	assert.equal(storage.getItem("lh-outbox"), JSON.stringify([{ id: "a" }]));
});
