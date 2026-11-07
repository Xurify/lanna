import assert from "node:assert/strict";
import { test } from "node:test";
import { tidyTitle } from "../src/core/course.ts";

test("a unit title is a heading: first letter capital, after a Words: label too", () => {
	assert.equal(tidyTitle("Words: hello and thanks"), "Words: Hello and thanks");
	assert.equal(tidyTitle("Words:   everyday verbs"), "Words: Everyday verbs");
	assert.equal(tidyTitle("present tense: I"), "Present tense: I");
	assert.equal(tidyTitle("Verbs for 'I'"), "Verbs for 'I'");
	assert.equal(tidyTitle("Words: Family"), "Words: Family", "already a heading");
	assert.equal(tidyTitle("Words: 3 colors"), "Words: 3 colors", "a digit stays");
});
