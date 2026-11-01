/**
 * SSR pins for the settings section components. Fetches never run under
 * renderToStaticMarkup, so the SSR state is the loading state. Controls behind
 * Advanced are checked in render-settings-advanced.test.tsx.
 */
import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TOGGLE_TOOLS, AiSection } from "../components/settings/ai-section.tsx";
import { AppearanceSection, GraphSection } from "../components/settings/appearance-section.tsx";
import { KeysSection } from "../components/settings/keys-section.tsx";
import { KeyboardSection } from "../components/settings/keyboard-section.tsx";
import type { GraphSettings } from "../src/core/index.ts";
import { SettingsDialogBody, SettingsDialogProvider } from "../components/settings/settings-dialog.tsx";
import { KEYBOARD_ACTIONS } from "../src/core/index.ts";

/** Opening tag of the element with this testid (attribute order is not contractual). */
function tagOf(html: string, testid: string): string {
	const i = html.indexOf(`data-testid="${testid}"`);
	assert.ok(i >= 0, `missing ${testid}`);
	return html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}

describe("SettingsDialog (the designed surface, SSR)", () => {
	it("provider CLOSED: children only — no dialog, no portal content", () => {
		const html = renderToStaticMarkup(
			<SettingsDialogProvider>
				<p>the app</p>
			</SettingsDialogProvider>,
		);
		assert.ok(html.includes("the app"));
		assert.ok(!html.includes("settings-backdrop"));
		assert.ok(!html.includes("settings-dialog"));
	});

	it("the dialog frame: role=dialog + the ✕ + the nav, General first and open, AI setup below the divider", () => {
		const html = renderToStaticMarkup(<SettingsDialogBody onClose={() => {}} />);
		assert.ok(html.includes('role="dialog"'));
		assert.ok(html.includes('aria-modal="true"'));
		assert.ok(html.includes('aria-label="Close settings"'));
		for (const id of ["general", "sound", "keys", "ai", "appearance", "graph", "keyboard"]) {
			assert.ok(html.includes(`data-testid="settings-nav-${id}"`), id);
		}
		// General is the landing section; the AI setup sits after the everyday ones.
		assert.ok(tagOf(html, "settings-nav-general").includes('aria-current="true"'));
		assert.ok(html.indexOf('data-testid="settings-nav-sound"') < html.indexOf('role="separator"'));
		assert.ok(html.indexOf('role="separator"') < html.indexOf('data-testid="settings-nav-ai"'));
		assert.ok(html.includes(">AI models</button>") && html.includes(">API keys</button>"));
		assert.ok(tagOf(html, "settings-nav-keyboard").includes('aria-current="false"'));
		// Fetches don't run under SSR — the loading state IS the SSR state.
		assert.ok(html.includes("Loading settings…"));
		// Modal-only doctrine: no link back to /settings anywhere in it.
		assert.ok(!html.includes('href="/settings"'));
	});
});

describe("AiSection (thin SSR)", () => {
	it("renders the three model SLOT rows (slots-only, fix wave: unpicked reads —, no Default option)", () => {
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		for (const slot of ["strong", "cheap", "vision"]) {
			assert.ok(html.includes(`data-testid="slot-row-${slot}"`), slot);
			assert.ok(html.includes(`data-testid="slot-model-${slot}"`), `${slot} model trigger`);
			assert.ok(html.includes(`data-testid="slot-thinking-${slot}"`), `${slot} thinking trigger`);
			assert.ok(html.includes("The main model for your sessions") || slot !== "strong", "strong roster");
		}
		// No Default anywhere: an unpicked slot reads "—".
		assert.equal((html.match(/>Default<\/span>/g) ?? []).length, 0, "no Default trigger");
		assert.ok(!html.includes('data-testid="menu-default"'), "no Default row");
		assert.equal((html.match(/>—<\/span>/g) ?? []).length, 6, "three slots × two — triggers");
		for (const role of ["researcher", "demoBuilder", "visualMaker"]) {
			assert.ok(!html.includes(`data-testid="role-row-${role}"`), `${role} retired`);
		}
		assert.ok(html.includes('data-testid="group-models"'), "Models sub-group");
		assert.ok(html.includes('data-testid="group-tools"'), "Tools sub-group");
		assert.ok(html.includes('data-testid="advanced-tutor-toggle"'), "the prompts sit behind Advanced");
	});

	it("the search-engine row renders with its live reason (search wave 2026-09-20)", () => {
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		assert.ok(html.includes('data-testid="search-engine-row"'), "the row");
		assert.ok(html.includes('data-testid="search-engine-trigger"'), "the trigger");
		// SSR never fires /api/search, so there is no reason line yet.
		assert.ok(html.includes("Automatic"), "unset engine reads Automatic");
		const html2 = renderToStaticMarkup(
			<AiSection agent={{ search: { engine: "tavily" } }} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />,
		);
		assert.ok(html2.includes("Tavily"), "pinned engine visible in the trigger");
	});

	it("the prober graph-tools row: FIRST in the Tools group, default ON, its own key (wave 7)", () => {
		// Graph on and graphTools absent: the row is ON with its hint.
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		const toolsGroup = html.split('data-testid="group-tools"')[1] ?? "";
		const rows = [...toolsGroup.matchAll(/data-testid="(graph-tools-row|tool-row-\w+)"/g)].map((m) => m[1]);
		assert.equal(rows[0], "graph-tools-row", "graph tools is the FIRST row of the Tools group");
		assert.ok(html.includes("It checks what you learned in earlier sessions."), "the describing hint");
		assert.ok((html.split('data-testid="graph-tools-row"')[1] ?? "").includes('aria-checked="true"'), "absent = on");
		const rowHtml = html.split('data-testid="graph-tools-row"')[1]?.split('data-testid="tool-row-')[0] ?? "";
		assert.ok(!rowHtml.includes("opacity-40"), "lit while the graph is on (the search row may dim — no keys in SSR)");
	});

	it("graph disabled dims the graph-tools row with the honest hint (the predicate composes)", () => {
		const html = renderToStaticMarkup(
			<AiSection agent={undefined} models={undefined} graph={{ enabled: false }} onSectionChange={() => {}} onModelsChange={() => {}} />,
		);
		const row = html.split('data-testid="graph-tools-row"')[1]?.split('data-testid="tool-row-')[0] ?? "";
		assert.ok(row.includes("opacity-40"), "row dims when the graph is off");
		assert.ok(row.includes("Turn on Skill map to use this."), "the reason hint replaces the description");
		assert.ok(row.includes("disabled"), "toggle untouchable while the graph is off");
	});

	it("an explicit graphTools off shows stored-off (the record never lies)", () => {
		const html = renderToStaticMarkup(
			<AiSection agent={{ graphTools: { enabled: false } }} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />,
		);
		const row = html.split('data-testid="graph-tools-row"')[1] ?? "";
		assert.ok(row.includes('aria-checked="false"'), "stored-off renders off");
	});

	it("renders the owner's FINAL tool list — research, demo, visual, pdf", () => {
		assert.deepEqual([...TOGGLE_TOOLS], ["research", "demo", "visual", "pdf"]);
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		for (const id of TOGGLE_TOOLS) assert.ok(html.includes(`data-testid="tool-row-${id}"`), id);
	});

	it("tools default ON (absent key = enabled)", () => {
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		for (const id of TOGGLE_TOOLS) {
			assert.ok(tagOf(html, `toggle-tool-${id}`).includes('aria-checked="true"'), `${id} defaults on`);
		}
	});

	it("an overridden SLOT shows its model in the trigger, tools carry the delta", () => {
		const html = renderToStaticMarkup(
			<AiSection
				agent={{ tools: { demo: false } }}
				models={{ strong: { model: { provider: "zai", id: "glm-4.7-flash" } } }}
				onSectionChange={() => {}}
				onModelsChange={() => {}}
			/>,
		);
		// The stored id shows even without a catalog loaded.
		assert.ok(html.includes("glm-4.7-flash"), "the override id is visible (prettyModel form, no auto-caps)");
		assert.ok(tagOf(html, "toggle-tool-demo").includes('aria-checked="false"'), "demo off");
		assert.ok(tagOf(html, "toggle-tool-visual").includes('aria-checked="true"'), "visual still on");
	});

	it("Advanced is closed under SSR: the prompts and the threshold are not in the first paint", () => {
		const html = renderToStaticMarkup(<AiSection agent={undefined} models={undefined} graph={undefined} onSectionChange={() => {}} onModelsChange={() => {}} />);
		assert.ok(tagOf(html, "advanced-tutor-toggle").includes('aria-expanded="false"'));
		assert.ok(!html.includes("Loading prompt segments"), "the prompts mount on open");
	});
});

describe("GraphSection — master switch + chunk budget (wave 7 + 2026-10-02)", () => {
	// Master switch and chunk budget, resolved by the same core resolver the server uses.
	it("renders the master switch as Keep building the map (the data channel, renamed 2026-10-06)", () => {
		const html = renderToStaticMarkup(<GraphSection graph={undefined} onSectionChange={() => {}} />);
		assert.ok(html.includes('data-testid="graph-row-enabled"'));
		assert.ok(html.includes(">Keep building the map<"), "the row names the DATA channel, not 'Graph'");
		assert.ok(!html.includes("graph-row-embedding"), "the dead rungs render nothing");
		assert.ok(!html.includes("Embedding model"), "the picker is gone");
		assert.ok(!html.includes("graph-row-clustering"));
		assert.ok(!html.includes("graph-row-labeling"));
		assert.ok(tagOf(html, "toggle-extraction-enabled").includes('aria-checked="true"'), "absent record = factory ON");
	});

	it("a stored off record shows the extraction switch off", () => {
		const html = renderToStaticMarkup(<GraphSection graph={{ enabled: false }} onSectionChange={() => {}} />);
		assert.ok(tagOf(html, "toggle-extraction-enabled").includes('aria-checked="false"'));
	});

	it("the map-on-home row (2026-10-06): display-only — absent record = factory ON, stored off shows off", () => {
		const html = renderToStaticMarkup(<GraphSection graph={undefined} onSectionChange={() => {}} />);
		assert.ok(html.includes('data-testid="graph-row-rendering"'));
		assert.ok(html.includes(">Show the map on home<"));
		assert.ok(tagOf(html, "toggle-graph-rendering-enabled").includes('aria-checked="true"'), "the home defaults to the canvas");
		const off = renderToStaticMarkup(<GraphSection graph={{ rendering: false }} onSectionChange={() => {}} />);
		assert.ok(tagOf(html, "toggle-extraction-enabled").includes('aria-checked="true"'), "rendering off does NOT touch extraction");
		assert.ok(tagOf(off, "toggle-graph-rendering-enabled").includes('aria-checked="false"'));
	});

	it("Map update size sits under Advanced: closed in the first paint", () => {
		const html = renderToStaticMarkup(<GraphSection graph={undefined} onSectionChange={() => {}} />);
		assert.ok(tagOf(html, "advanced-graph-toggle").includes('aria-expanded="false"'));
		assert.ok(!html.includes('data-testid="input-chunk-tokens"'), "the budget input mounts on open");
	});
});

describe("KeysSection (thin SSR)", () => {
	it("SSR = the loading state (effects never fire)", () => {
		const html = renderToStaticMarkup(<KeysSection />);
		assert.ok(html.includes(`aria-label="Loading keys"`), "a skeleton of the key rows while they load");
	});
});

describe("AppearanceSection (thin SSR)", () => {
	it("mode is a fact, not a control: it reads Dark and names the light mode that is coming", () => {
		const html = renderToStaticMarkup(<AppearanceSection appearance={undefined} onSectionChange={() => {}} />);
		assert.ok(html.includes('data-testid="mode-value"'));
		assert.ok(html.includes(">Dark</span>"), "the only mode is Dark");
		assert.ok(html.includes("Light mode is coming soon"));
		assert.ok(!html.includes('data-testid="select-mode"'), "no select to mistake for a control");
	});

	it("the reading font trigger shows the factory family; the size reads 16px; the colors sit under Advanced", () => {
		// The reading font is a searchable dropdown showing the factory family.
		const html = renderToStaticMarkup(<AppearanceSection appearance={undefined} onSectionChange={() => {}} />);
		assert.ok(html.includes('data-testid="font-trigger"'));
		assert.ok(html.includes("16px"));
		assert.ok(tagOf(html, "advanced-appearance-toggle").includes('aria-expanded="false"'));
		assert.ok(!html.includes('data-testid="input-background"'), "the colors mount on open");
	});
});

describe("KeyboardSection (thin SSR)", () => {
	it("renders every registry action in its scope group", () => {
		const html = renderToStaticMarkup(<KeyboardSection />);
		for (const def of KEYBOARD_ACTIONS) {
			assert.ok(html.includes(`data-testid="kbd-row-${def.id}"`), def.id);
		}
		assert.ok(html.includes("kbd-scope-global"));
		assert.ok(html.includes("kbd-scope-chat"));
	});

	it("open-settings is in the registry with the settings chord", () => {
		const def = KEYBOARD_ACTIONS.find((a) => a.id === "open-settings");
		assert.ok(def, "the action exists");
		assert.equal(def?.scope, "global");
		assert.equal(def?.binding, "mod+,");
	});

	it("displayOnly actions list but never offer Rebind", () => {
		const html = renderToStaticMarkup(<KeyboardSection />);
		assert.ok(html.includes("Fixed — part of this screen"));
		assert.ok(!html.includes(`data-testid="kbd-rebind-question-next-row"`), "surface keys stay put");
		// Model-menu rows are not registry settings.
		assert.ok(!html.includes("Model menu"), "model-menu rows removed");
		assert.ok(!KEYBOARD_ACTIONS.some((a) => a.id as string === "model-menu-walk"));
		assert.ok(!KEYBOARD_ACTIONS.some((a) => a.id as string === "model-menu-pick"));
	});
});
