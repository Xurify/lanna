import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentEvent, AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { providerEventObserver } from "./provider-events.ts";
import type { Message, Usage } from "@earendil-works/pi-ai";
import { APP_IDENTITY, type PiEngine } from "./models.ts";
import { effectivePromptSegments } from "./prompt-segments.ts";
import { learnerProfileSegment } from "./learner-profile.ts";
import { practiceTools, type PracticeToolContext } from "./tools/practice.ts";
import { chatTools, type ChatToolContext } from "./tools/chat.ts";
import { withArgumentHeal } from "./tools/heal.ts";
import { sendToUserTool } from "./tools/send-to-user.ts";
import { filterToggleableTools, type EnabledTools } from "../core/pending.ts";
import { PRACTICE_PROBLEM_TOOL } from "../core/chat-messages.ts";
import { toLlmMessages } from "../core/model-context.ts";
import { closesChatReply } from "../core/chat-answers.ts";
import { activeProfile } from "../../config.ts";

/**
 * The two tutor agents: the Ask chat and the practitioner of a tutor unit.
 * Each is rebuilt per request from the stored record (the record is the
 * source of truth) and discarded at turn end. Engines are injectable so
 * tests drive a scripted faux engine.
 *
 * A system prompt is the shared fragments plus the agent's own directory
 * (src/agent/prompts/<kind>/), numeric-prefix files only, in filename order.
 */

/** Which agent's prompt directory to compose. Practice (2026-10-04)
 *  composes ONLY its own directory — see prompt-segments.ts. */
type AgentKind = "practice" | "chat";

// P2 (2026-09-19): segment discovery + override resolution live in ONE
// canonical place now — src/store/prompt-overrides.ts (listSourceSegments
// mirrors this loader's rules, shared/ included). The agent imports it for
// the static-file seam; the local fragment discovery helpers are retired.

/** Exported for tests: assert what composes into the model's prompt.
 *  Composition order: shared base → shared/ fragments (both agents, the
 *  sources-v1 seam for cross-agent doctrine) → the agent's own fragments.
 *
 *  P2 reconciliation (2026-09-19): composition is DELEGATED to the store
 *  module's effectivePromptSegments — one canonical segment-discovery
 *  rule (its listSourceSegments mirrors this loader's, now including
 *  shared/) — so per-segment OVERRIDES ride the same path: a segment
 *  whose switch is ON and whose override file exists composes the
 *  override text instead of the source. `switches` is the settings
 *  record's agent.prompts map (absent key = off), threaded per turn via
 *  AgentBuildOptions.promptSwitches; a switches-less call composes pure
 *  source (byte-identical to the pre-refactor loader — pinned in
 *  tests/prompt-overrides.test.ts). Overrides are a static-file read
 *  through config paths, not request state — the store import carries no
 *  chat/job machinery. */
export function composeInstructions(kind: AgentKind, switches?: Record<string, boolean>): string {
	const segments = effectivePromptSegments(kind, switches ?? {});
	return segments
		.map((s) => (s.enabled ? s.overrideText! : s.sourceText))
		.map((t) => t.trim())
		.filter(Boolean)
		.join("\n\n---\n\n");
}

// The switch-free source composition, cached per kind and active language profile.
// With promptSwitches provided, baseAgentOptions composes FRESH per turn —
// an override file written while its switch is ON must flip the next
// turn's composition; the cache serves only the switches-less path.
const composedInstructionsCache = new Map<string, string>();

function getComposedInstructions(kind: AgentKind): string {
	const key = `${kind}:${activeProfile()}`;
	let cached = composedInstructionsCache.get(key);
	if (!cached) {
		cached = composeInstructions(kind);
		composedInstructionsCache.set(key, cached);
	}
	return cached;
}

// Money channel (wave 4): the turn runner passes a per-turn collector;
// every model call's usage lands in the chat record's turns log
// (ChatStore.appendTurnUsage). The narrow param keeps the seam honest.
export type StepUsageCollector = (usage: Usage) => void;

/** Per-request construction options (the handler wires all of these). */
export interface AgentBuildOptions {
	/** Model + stream function — tests inject a scripted faux engine. */
	engine?: PiEngine;
	/** The initial transcript, as pi messages (the record IS agent state). */
	messages?: AgentMessage[];
	/** Money channel: one call per model request. */
	onUsage?: StepUsageCollector;
	/** Tests may pass a bare tool registry to drive deterministic flows.
	 *  An explicit registry is NEVER toggle-filtered — the caller owns it. */
	tools?: Record<string, AgentTool<any>>;
	/** The resolved per-user tool toggles (core/pending EnabledTools — the
	 *  2026-09-19 P2 bridge: the turn runner passes
	 *  effective.agent.tools; the factories drop any tool explicitly false.
	 *  THE DEFINITIVE toggleable set is TOGGLEABLE_TOOLS (job tools only);
	 *  the filtering is generic, but writes validate against the list). */
	toolToggles?: EnabledTools;
	/** Per-segment system-prompt override SWITCHES (the settings record's
	 *  agent.prompts map, absent key = off — same keys the settings routes
	 *  and effectivePromptSegments use). Provided → the prompt composes
	 *  fresh per turn, honoring enabled overrides (switch on + file
	 *  exists); absent → the cached pure-source composition. */
	promptSwitches?: Record<string, boolean>;
	/** Native conversation identity: the existing persisted chat id, reused
	 * across reconstructed prober, teacher, and practice Agents.
	 * Debug: when set AND LANNA_PROVIDER_EVENTS=1, raw provider stream events
	 *  (pre-normalization) append to data/debug/provider-events/
	 *  <chatId>.jsonl via providerEventObserver — the GLM-truncation /
	 *  DeepSeek-id incident layer. Absent or env-off → no observer. */
	chatId?: string;
	/** A model-only note appended to the learner's typed text (the chat's checker evidence). */
	noteLearnerText?: (text: string) => string | null;
	appContent?: string;
}

function makeTurnStopper(kind: AgentKind) {
	return (context: {
		message: { content: Array<{ type: string; id?: string; name?: string; text?: string }> };
		toolResults: Array<{ toolCallId: string; isError?: boolean }>;
	}): boolean => {
		if (kind === "chat" && closesChatReply(context.message.content)) {
			const failed = context.toolResults
				.filter((r) => r.isError)
				.map((r) => context.message.content.find((c) => c.id === r.toolCallId)?.name ?? r.toolCallId);
			if (failed.length)
				console.warn(`[chat] reply kept, record call failed and was not retried: ${failed.join(", ")}`);
			return true;
		}
		const called = new Set(
			context.message.content
				.filter(
					(c) =>
						c.type === "toolCall" && c.name !== undefined && kind === "practice" && c.name === PRACTICE_PROBLEM_TOOL,
				)
				.map((c) => c.id!),
		);
		if (called.size === 0) return false;
		// Stop only when every problem pose resolved cleanly.
		for (const result of context.toolResults) {
			if (called.has(result.toolCallId) && result.isError) return false;
		}
		return true;
	};
}

function baseAgentOptions(kind: AgentKind, opts: AgentBuildOptions, tools: AgentTool<any, any>[]) {
	const engine = opts.engine;
	if (!engine) throw new Error(`no configured model for the ${kind} agent — set your model slots (settings → models)`);
	const stopper = makeTurnStopper(kind);
	// The learner profile (onboarding, 2026-10-28): what the app knows —
	// goal, pace, first language, placement, the lesson ledger — joins
	// the composition as a trailing block, read fresh per build so a
	// lesson between turns changes it. Null on a fresh profile.
	const profile = learnerProfileSegment();
	const composed = opts.promptSwitches ? composeInstructions(kind, opts.promptSwitches) : getComposedInstructions(kind);
	const systemPrompt = [composed, opts.appContent, profile].filter(Boolean).join("\n\n---\n\n");
	// Debug recorder (owner, 2026-10-04): raw provider events when
	// LANNA_PROVIDER_EVENTS=1 and the caller handed a chatId; undefined is
	// the normal no-observer path (tests, env-off).
	const providerEvents = opts.chatId ? providerEventObserver(opts.chatId, kind) : undefined;
	const agent = new Agent({
		identity: APP_IDENTITY,
		sessionId: opts.chatId,
		initialState: {
			systemPrompt,
			model: engine.model,
			thinkingLevel: engine.level,
			// Conditional registry inclusion, like the graph-tool gates: when
			// closed, neither the tool nor its usage instructions reach the model.
			// Match Claude across providers (including OpenRouter), not the API
			// transport. Explicit test registries remain caller-owned.
			tools: [
				...tools,
				...(opts.tools === undefined && kind !== "chat" && engine.model.id.toLowerCase().includes("claude")
					? [withArgumentHeal(sendToUserTool)]
					: []),
			],
			messages: opts.messages ?? [],
		},
		streamFn: engine.streamFn,
		...(providerEvents ? { onProviderStreamEvent: providerEvents } : {}),
		// 0.87.1: shouldStopAfterTurn → finishTurn. Same call point (after
		// tool results attach, before turn_end) and `{ action: "end" }` still
		// exits BEFORE the steering poll — the parked-marker stranding our
		// Wave C registerLiveAgent-before-runPiTurn design depends on.
		// undefined preserves normal scheduling (the old boolean false).
		finishTurn: (turn) => (stopper(turn) ? { action: "end" } : undefined),
		// Wave C (2026-09-26, owner correction same day): markers handed to a
		// live run drain from pi's STEERING queue — the lesson loop is one
		// continuous teach→quiz→teach run, so delivery must inject at turn
		// boundaries INSIDE the run, not wait for it to stop (follow-ups).
		// "all" joins every handed marker at one boundary, matching the idle
		// wake's carry-everything semantics (the default "one-at-a-time"
		// would spend one teacher turn per marker).
		steeringMode: "all",
		// The model-facing conversion is the app's one seam: markers flatten to
		// their canonical user text, the app's id fields strip, and an
		// aborted call gets an interrupted result. It must never throw (pi's
		// convertToLlm contract).
		convertToLlm: opts.noteLearnerText
			? (messages) => withLearnerNotes(toLlmMessages(messages), opts.noteLearnerText!)
			: toLlmMessages,
	});
	if (opts.onUsage) {
		agent.subscribe((event: AgentEvent) => {
			if (event.type === "message_end" && event.message.role === "assistant" && "usage" in event.message) {
				// A cancelled call is not a billed step (partial/estimated
				// usage on an aborted message is not money spent).
				if (event.message.stopReason === "aborted") return;
				opts.onUsage!(event.message.usage);
			}
		});
	}
	return agent;
}

/**
 * The PRACTITIONER (practice sessions, owner design 2026-10-04): built
 * from turn 1 of a kind:"practice" session. Its ENTIRE registry is
 * problem + conclude (tools/practice.ts); the doctrine prompt
 * (prompts/practice/) carries the method. A successful problem pose ends
 * the run, natively for a problem-only batch and via the shared stop hook
 * for a mixed batch (for example, send_to_user + problem).
 */
export function createPracticeAgent(ctx: PracticeToolContext, opts: AgentBuildOptions = {}) {
	const tools = opts.tools ?? filterToggleableTools(practiceTools(ctx), opts.toolToggles);
	return baseAgentOptions("practice", opts, Object.values(tools));
}

export function withLearnerNotes(messages: Message[], note: (text: string) => string | null): Message[] {
	return messages.map((message) => {
		if (message.role !== "user") return message;
		if (typeof message.content === "string") {
			const extra = note(message.content);
			return extra ? { ...message, content: `${message.content}\n\n${extra}` } : message;
		}
		const text = message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const extra = text ? note(text) : null;
		return extra ? { ...message, content: [...message.content, { type: "text" as const, text: extra }] } : message;
	});
}

export function createChatAgent(ctx: ChatToolContext, opts: AgentBuildOptions = {}) {
	const tools = opts.tools ?? filterToggleableTools(chatTools(ctx), opts.toolToggles);
	return baseAgentOptions("chat", opts, Object.values(tools));
}

export type PracticeAgent = ReturnType<typeof createPracticeAgent>;
export type ChatAgent = ReturnType<typeof createChatAgent>;
export type TeachingAgent = PracticeAgent | ChatAgent;
