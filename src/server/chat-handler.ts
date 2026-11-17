import type { Usage } from "@earendil-works/pi-ai";
import {
	createChatAgent,
	createPracticeAgent,
	type AgentBuildOptions,
	type TeachingAgent,
} from "../agent/teacher-agent.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { type SourceToolContext } from "../agent/tools/sources.ts";
import { activeProfile, type ModelRole } from "../../config.ts";
import { slovakLookup } from "../agent/lexicon.ts";
import { checkerNote, checkSlovak } from "../core/slovak-check.ts";
import type { LannaMessage } from "../core/native-messages.ts";
import { reconcileUserSteers, registerLiveAgent, unregisterLiveAgent } from "./steers.ts";
import { runPiTurn } from "./pi/ui-stream.ts";
import { collectToolCallIds } from "./pi/call-ids.ts";
import { providerEventNote } from "../agent/provider-events.ts";
import { effectiveSettings, stores } from "./stores.ts";
import { searchProvider } from "./search.ts";
import { providerKeyPresent } from "./keys.ts";
import { resolveConversationSpec, resolveRoleSpec } from "../core/settings-resolution.ts";
import { modelsNotConfigured, providerKeyMissing as providerKeyMissingEnvelope } from "../core/settings.ts";
import { beginTurn, endTurn } from "./turn-liveness.ts";
import { applyParkedDismissal } from "./dismissal-park.ts";
import { registerTurn, rememberTurnFailure, unregisterTurn } from "./turn-runs.ts";
import { persistTurn, TurnPersistenceError } from "./turn-service.ts";
import { danglingQuestionOf } from "../core/native-messages.ts";
import { composeInstructions } from "../agent/teacher-agent.ts";
import { ensureCompacted, kickCompaction, effectiveThresholdTokens } from "./compaction.ts";
import { catalogContextLimits } from "./model-catalog.ts";
import { emit } from "../core/events.ts";
import { settledTurnResponse } from "./turn-runs.ts";
import { asAgentMessages } from "../core/native-messages.ts";
import { ChatInputError, inputAppends, parseChatInput, type TurnInput } from "../core/input-events.ts";
import type { CallUsage } from "../core/contracts.ts";
import type { ChatRecord } from "../core/contracts/chat.ts";
import { recordChatAnswer } from "./chat-evidence.ts";
import { enqueueWords, reviewDigest } from "./review.ts";
import { appContentNow } from "./app-content.ts";
import { drawForReply, latestReplyText } from "./drawing.ts";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

/** Lanna: the spaced-review seam every agent's language tools use. */
const reviewSeam = { enqueue: (slugs: string[]) => enqueueWords(slugs), digest: () => reviewDigest() };

function chatCheckerNote(text: string): string | null {
	if (activeProfile() !== "slovak" || text.startsWith("[")) return null;
	return checkerNote(checkSlovak(text, slovakLookup() ?? undefined));
}

function chatAppContent(chatId: string): string | undefined {
	try {
		return appContentNow();
	} catch (err) {
		console.error(`[chat ${chatId}] the app's content map could not be read:`, err);
		return "# What the app has\n\nNot available this turn: say you cannot look up the app's lessons right now.";
	}
}

function promptKind(record: ChatRecord): "practice" | "chat" {
	return record.kind === "practice" ? "practice" : "chat";
}

/** A practice answer in Slovak carries what the checker can say for
 *  certain (core/slovak-check.ts) into the model's copy of it. The learner's
 *  card reads `details.text`, so they never see the note. */
function withSlovakEvidence(message: LannaMessage): LannaMessage {
	if (activeProfile() !== "slovak" || message.role !== "custom" || message.customType !== "practice-thinking")
		return message;
	const text = (message.details as { text?: string } | undefined)?.text;
	const note = text ? checkerNote(checkSlovak(text, slovakLookup() ?? undefined)) : null;
	return note ? { ...message, content: `${message.content}\n\n${note}` } : message;
}

/**
 * One chat turn over the server-owned native record. Framework-free (plain
 * Request/Response) so tests can drive it directly with a scripted faux
 * engine — the Next route handler in app/api/chat is a one-line wrapper.
 *
 * THE INPUT-EVENTS CONTRACT (Wave B, owner ruling 2026-09-26): POST /api/chat
 * carries {chatId, input} — one explicit event (text / answer / verdict /
 * continue), never a client transcript. The server owns the record; this
 * module is the TURN COMPOSITION ROOT: it turns the event into native
 * record appends (core/input-events.ts), builds the agent from the record
 * (the record IS the agent state — state.messages = record.messages,
 * continue()), and runs the turn as a background object (pi/ui-stream.ts).

 */

function callUsageOf(usage: Usage): CallUsage {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		cacheReadTokens: usage.cacheRead,
		cacheWriteTokens: usage.cacheWrite,
		cacheWrite1hTokens: usage.cacheWrite1h ?? 0,
		// Optional in pi's Usage — persisted as 0, never dropped.
		reasoningTokens: usage.reasoning ?? 0,
	};
}

function settlementErrorText(error: unknown): string {
	return error instanceof TurnPersistenceError ? error.message : "An error occurred.";
}

/** The settings-resolved engine for one role, read fresh per call; undefined when no model is set for it. */
function resolveEngine(role: ModelRole): PiEngine | undefined {
	const spec = resolveRoleSpec(role, stores.settingsStore.readSettings());
	return spec ? piEngineForSpec(spec) : undefined;
}

/** The route-facing entry: parse {chatId, input} and run one turn. */
export async function handleChatRequest(
	req: Request,
	buildAgent?: (opts: AgentBuildOptions & { kind?: ChatRecord["kind"] }) => TeachingAgent,
): Promise<Response> {
	let body: { chatId?: unknown; input?: unknown };
	try {
		body = await req.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}
	const chatId = typeof body.chatId === "string" ? body.chatId : "";
	if (!chatId) return Response.json({ error: "Unknown chat" }, { status: 404 });
	let input: TurnInput;
	try {
		input = parseChatInput(body.input);
	} catch (err) {
		if (err instanceof ChatInputError) {
			return Response.json({ error: err.message }, { status: 400 });
		}
		throw err;
	}
	return handleChatInput(chatId, input, buildAgent);
}

/** The turn composition: one input event → native record appends → one agent turn as a background object. */
export async function handleChatInput(
	chatId: string,
	input: TurnInput,
	buildAgent?: (opts: AgentBuildOptions & { kind?: ChatRecord["kind"] }) => TeachingAgent,
): Promise<Response> {
	let record = stores.chatStore.getChat(chatId);
	if (!record) {
		return Response.json({ error: "Unknown chat" }, { status: 404 });
	}

	// THE UNIVERSAL TURN GATE (BYOK, owner, 2026-09-22): a turn needs the
	// CONVERSATION chain — the chat's own model override over the strong
	// slot — and there is no factory floor; when both are empty the turn
	// refuses honestly with the machine-readable 503 envelope (new sessions
	// and continuing ones alike — wake-pipeline turns ride this same path).
	// Placement is deliberate: BEFORE beginTurn (no liveness effects), the
	// write-ahead persist (nothing durable changes), and every downstream
	// resolution (jobs gate per-need on their own tiers).
	const effective = effectiveSettings();
	const conversation = resolveConversationSpec(record.settings, effective.models.strong);
	if (!conversation) {
		const envelope = modelsNotConfigured(["strong"]);
		console.info(`[chat ${chatId}] turn refused — ${JSON.stringify(envelope)}`);
		return Response.json(envelope, { status: 503 });
	}

	// THE KEY-PRESENCE GATE (provider-key interlude, owner, 2026-09-25): a
	// pinned model is not enough — its PROVIDER's key must be present, or
	// the turn dies mid-stream masked to a generic error. Truth is env-first
	// (providerKeyPresent reads what pi-ai would read at request time), so
	// an env-shadowed key passes. Same placement discipline as the models
	// gate: BEFORE beginTurn (no liveness effects) and the write-ahead
	// persist (nothing durable changes); wake-pipeline turns ride the same
	// path. The affected tier is strong — the conversation chain's own tier
	// (a chat.model override still resolves through it).
	if (!providerKeyPresent(conversation.provider)) {
		const envelope = providerKeyMissingEnvelope(conversation.provider, ["strong"]);
		console.info(`[chat ${chatId}] turn refused — ${JSON.stringify(envelope)}`);
		return Response.json(envelope, { status: 503 });
	}

	// THE COMPACTION GATE (owner round 14, 2026-10-05 — the structural
	// ruling: NOTHING model-facing for this chat interleaves with a
	// running compaction): await any in-flight compaction (the settle
	// kick usually finished inside the learner's answer pause), and if
	// the record is STILL over threshold, compact synchronously — this
	// request waits. Skipped under tests (the scripted-chat precedent);
	// placement mirrors the BYOK/key gates — BEFORE appends and
	// beginTurn, no liveness effects — and the record re-reads after
	// because compaction appends the marker.
	let conversationEngine: PiEngine;
	try {
		conversationEngine = piEngineForSpec(conversation);
	} catch {
		return Response.json({ error: "The selected model is unavailable." }, { status: 503 });
	}
	const modelIdForCompaction = `${conversationEngine.model.provider}:${conversationEngine.model.id}`;
	await ensureCompacted(
		{
			chatStore: stores.chatStore,
			engine: conversationEngine,
			modelId: modelIdForCompaction,
			thresholdTokens: effectiveThresholdTokens(
				effective.compaction?.thresholdTokens,
				catalogContextLimits().get(modelIdForCompaction),
			),
			systemPromptTokens: Math.ceil(composeInstructions(promptKind(record)).length / 4),
		},
		chatId,
	);
	const compactedRecord = stores.chatStore.getChat(chatId);
	if (!compactedRecord) return Response.json({ error: "Unknown chat" }, { status: 404 });
	record = compactedRecord;

	// The input's native appends (pure). Computed BEFORE beginTurn so a
	// refused input leaves no liveness effects; read against the CURRENT record.
	let appends;
	try {
		appends = inputAppends(record, input).map(withSlovakEvidence);
	} catch (err) {
		if (err instanceof ChatInputError) {
			return Response.json({ error: err.message }, { status: 400 });
		}
		throw err;
	}

	// THE PARALLEL-QUESTION GATE (owner, 2026-10-03 — the deepseek parallel
	// batch incident): an answer that leaves a SIBLING question dangling
	// defers its wake. The dock advances to the next question (the client's
	// optimistic result + record-changed carry the view); the LAST answer
	// fires the one reaction turn with every result ADJACENT to its calling
	// assistant message — the provider shape law (a tool result appended
	// after an intervening assistant message is rejected, which stranded
	// the sibling question permanently pre-fix). Nothing else can generate
	// while a question dangles (job wakes wait, continuation folds refuse,
	// the composer gates), so adjacency holds by construction.
	if (input.type === "answer" && danglingQuestionOf([...record.messages, ...appends]) !== null) {
		const merged = [...record.messages, ...appends];
		try {
			stores.chatStore.saveMessages(chatId, merged);
		} catch (err) {
			console.error(`[chat ${chatId}] write-ahead persist failed:`, err);
			return new Response("Your input could not be saved. Please try again.", { status: 500 });
		}
		emit("record-changed", { chatId });
		return settledTurnResponse(); // the cheap terminal — no beginTurn, no turn
	}

	// One turn per chat, ever. A second request while a turn runs means a
	// stale/remounted client raced a live one — letting it through would
	// double-run the teacher and clobber the first turn's persist.
	if (!beginTurn(chatId)) {
		console.info(`[chat ${chatId}] turn already in flight — request rejected`);
		return Response.json({ error: "A turn is already running for this session" }, { status: 409 });
	}

	// Write-ahead persistence: the input's native appends go on disk BEFORE
	// the turn starts - the learner's answer is durable the instant the
	// request arrives, and any remount, second tab, or server crash reads
	// truth instead of the pre-answer record. (Wave C: the wake's markers
	// ride this same write-ahead - the pump de-queued them at fire, so this
	// is the ONLY copy ever appended.)
	const merged = [...record.messages, ...appends];
	const persistBaseCount = merged.length;
	try {
		stores.chatStore.saveMessages(chatId, merged);
	} catch (err) {
		console.error(`[chat ${chatId}] write-ahead persist failed:`, err);
		endTurn(chatId);
		return new Response("Your input could not be saved. Please try again.", { status: 500 });
	}

	// MONEY CHANNEL (wave 4): one collector per request, fed by the agent's
	// message_end events. Every model call's usage lands in the chat record's
	// append-only turns log at onFinish — idempotent per turn id.
	const turnUsageId = crypto.randomUUID();
	const steps: CallUsage[] = [];
	const collectUsage = (usage: Usage) => {
		steps.push(callUsageOf(usage));
	};
	// research and pdf run on their own role's model, so their calls are a
	// usage entry of their own, priced under that model.
	const sources: SourceToolContext = {
		chatId,
		engineFor: (reader) => resolveEngine(reader === "research" ? "researcher" : "pdfReader"),
		cannotRun: (readerEngine) =>
			providerKeyPresent(readerEngine.model.provider) ? null : "its model's provider has no key (Settings → API keys)",
		search: searchProvider,
		recordUsage: (model, usage) =>
			stores.chatStore.appendTurnUsage(chatId, {
				id: crypto.randomUUID(),
				messageId: `reader_${turnUsageId}`,
				at: new Date().toISOString(),
				model,
				steps: usage.map(callUsageOf),
			}),
	};

	// BYOK (owner, 2026-09-22): the conversation chain was resolved by the
	// turn gate above (chat.model override → strong slot → refused) — the
	// engine build is pure from here; thinking levels clamp natively.
	// (Built once above the compaction gate; reused verbatim.)
	const engine = conversationEngine;
	// Provider-qualified stamp (model slots wave): matches the price table's
	// provider:id keys.
	const modelId = `${engine.model.provider}:${engine.model.id}`;
	// Tests inject a factory: the agent is stateless per turn, so each
	// request builds a fresh one off the record — the factory mirrors that
	// seam exactly. Wave B: the record IS the agent state (native messages;
	// the record's id field strips at the wire in toLlmMessages).
	// CROSS-STREAM SEAM (P2 reconciliation, 2026-09-19): `toolToggles`
	// rides the build opts as the user-level DELTA map (absent key =
	// enabled). The definitive toggleable set is TOGGLEABLE_TOOLS — the
	// sub-agent JOB tools (research/pdf; adjudicated with the
	// user: quiz/ask/fs/plan/probe_done are always-on).
	const agentOpts: AgentBuildOptions = {
		engine,
		messages: asAgentMessages(merged),
		onUsage: collectUsage,
		toolToggles: effective.agent.tools,
		// Debug (owner, 2026-10-04): teacher/prober raw provider events under
		// LANNA_PROVIDER_EVENTS=1 (provider-events.ts); no-op otherwise.
		chatId,
		// The prompt-override switches (P2, 2026-09-19): same resolution
		// point as the tool delta — the agent layer composes the system
		// prompt fresh per turn, swapping in any enabled override segments.
		promptSwitches: effective.agent.prompts,
	};
	// A practice session builds the practitioner (problem + conclude); every
	// other session, older kind-less records included, is the Ask chat.
	// buildAgent is the test seam, uniform across kinds.
	let turnMessages: () => readonly AgentMessage[] = () => [];
	const constructed: TeachingAgent = buildAgent
		? buildAgent({ ...agentOpts, kind: record.kind })
		: record.kind === "practice"
			? createPracticeAgent(
					{
						chatId,
						chatStore: stores.chatStore,
						sources,
						review: reviewSeam,
					},
					agentOpts,
				)
			: createChatAgent(
					{
						review: reviewSeam,
						answers: { record: (answer) => recordChatAnswer({ ...answer, at: new Date().toISOString(), chatId }) },
						drawing: {
							draw: (brief, signal) =>
								drawForReply({
									engine,
									reply: latestReplyText(turnMessages()),
									brief,
									signal,
									onUsage: collectUsage,
									chatId,
								}),
						},
						sources,
					},
					{ ...agentOpts, noteLearnerText: chatCheckerNote, appContent: chatAppContent(chatId) },
				);

	// A test-injected agent gets no usage collector (tests assert the
	// transcript, not the money channel); when it's ours, usage flows through
	// the factory's subscription (wired above via onUsage).
	try {
		// THE TURN AS A BACKGROUND OBJECT (owner ruling, 2026-09-25):
		// runPiTurn executes decoupled from this response — the POST stream
		// is just the FIRST subscriber (a view). A client disconnect can no
		// longer abort the turn; the remote kill is the abort channel, and
		// late views reattach via GET /api/chats/[id]/stream.
		// Wave C (owner correction, 2026-09-26 — steering): register the live
		// agent BEFORE runPiTurn — the loop's start steering-poll drains the
		// queue SYNCHRONOUSLY inside that call, so a later registration would
		// miss it. Registration also steers any pending registry markers into
		// this run: a marker parked behind a just-answered quiz rides THIS
		// run's first LLM call (the native replacement for continuation
		// coalescing). Settlement still cannot beat the flow below: it needs
		// a streamed response, which never happens inside the constructor.
		turnMessages = () => constructed.state.messages;
		registerLiveAgent(chatId, constructed);
		// Debug recorder run marker (owner, 2026-10-04): correlates the
		// JSONL event stream with the record's turns; no-op unless
		// LANNA_PROVIDER_EVENTS=1.
		providerEventNote(chatId, "turn", `run start (base: ${merged.length} messages)`);
		const handle = runPiTurn({
			agent: constructed,
			// The coalescing window seam (COMPACTION LAW, 2026-10-09): tests
			// tighten it via LANNA_UPDATE_FLUSH_MS; production rides the 100ms
			// default in ui-stream.
			...(process.env.LANNA_UPDATE_FLUSH_MS ? { updateFlushMs: Number(process.env.LANNA_UPDATE_FLUSH_MS) } : {}),
			// THE LACAN FIX (2026-10-04): seed the uniquifier with every
			// tool-call id the record already holds — a provider that resets
			// ids per response (DeepSeek) then gets fresh unique ids for this
			// turn's calls at the wire boundary, on the wire, in the record,
			// and in the next turn's context alike.
			usedToolCallIds: new Set(collectToolCallIds(merged)),
			// Stream-level failures are provider/transport internals — masked,
			// like the SDK defaults. Tool-input validation messages never
			// route through here: they ride the error-result path and reach the
			// transcript directly (the retry context the model saw).
			onError: (error) => {
				console.error(`[chat ${chatId}] turn error:`, error);
				return "An error occurred.";
			},
			onSettleError: settlementErrorText,
			onSettleFailure: (error, reportedErrorText) => {
				// POST only acknowledges acceptance; the submitter may attach
				// after this turn has already failed and left the registry.
				rememberTurnFailure(chatId, reportedErrorText ?? settlementErrorText(error));
				endTurn(chatId);
				unregisterTurn(chatId);
				unregisterLiveAgent(chatId);
				// The canonical save may have succeeded before later bookkeeping
				// threw. Reconcile against actual durability, never replay input
				// merely because usage/other settlement work failed.
				const persisted = stores.chatStore.getChat(chatId)?.messages ?? [];
				reconcileUserSteers(chatId, persisted);
			},
			onFinish: (turnMessages, isAborted) => {
				// Wave B: the record write is the agent's own final state —
				// the new messages are the slice past the merged base.
				const stamped = persistTurn(stores.chatStore, chatId, persistBaseCount, turnMessages, isAborted);
				// usage log append (idempotent per turn id) — the stats bar
				// refolds this on the client after the turn settles. The
				// provenance message is the turn's FIRST new assistant message.
				const response = stamped.find((m) => (m as { role?: string }).role === "assistant");
				if (response && steps.length > 0) {
					stores.chatStore.appendTurnUsage(chatId, {
						id: turnUsageId,
						messageId: response.id,
						at: new Date().toISOString(),
						model: modelId,
						steps,
					});
				}
				// PARKED DISMISSAL (owner, 2026-10-04): a dismissal that arrived
				// mid-turn was parked by the dismiss route (202); now that
				// persistTurn has landed the turn's messages, apply it against
				// real truth — BEFORE endTurn, so "turn-settled" guarantees a
				// subsequent fetch reads the dismissal already in the record
				// (the same ordering law as persistTurn itself).
				applyParkedDismissal(stores.chatStore, chatId);
				// LAST: a poller that sees not-in-flight must read an already-persisted
				// record — endTurn only after persistTurn has done its job.
				endTurn(chatId);
				// And only then does the turn stop being a running object
				// (background-turn wave, 2026-09-25): a reattach that finds
				// nothing must find the persisted record current — the same
				// ordering rule as endTurn.
				unregisterTurn(chatId);
				// The learner's steers: saved ones are done, stranded ones wait for the chat's next turn.
				unregisterLiveAgent(chatId);
				reconcileUserSteers(chatId, stamped);
				// THE SETTLE KICK (owner round 14): the turn settled — if the
				// projection is now over threshold, the summary starts in the
				// background, INSIDE the learner's reading/answering pause
				// (question/problem poses end runs, so this moment is always a
				// between-runs window). The next turn's ensureCompacted gate
				// awaits whatever this leaves running; a lost engine or a
				// beneath-threshold record is a silent no-op. Skipped under
				// tests (the scripted-chat precedent — scripted chats are
				// fixtures; the service itself is pinned directly).
				if (process.env.NODE_ENV !== "test")
					kickCompaction(() => {
						const fresh = effectiveSettings();
						const spec = resolveConversationSpec(stores.chatStore.getChat(chatId)?.settings, fresh.models.strong);
						if (!spec) return null;
						let kickEngine: PiEngine;
						try {
							kickEngine = piEngineForSpec(spec);
						} catch {
							return null;
						}
						const kickModelId = `${kickEngine.model.provider}:${kickEngine.model.id}`;
						const freshRecord = stores.chatStore.getChat(chatId);
						if (!freshRecord) return null;
						return {
							chatStore: stores.chatStore,
							engine: kickEngine,
							modelId: kickModelId,
							thresholdTokens: effectiveThresholdTokens(
								fresh.compaction?.thresholdTokens,
								catalogContextLimits().get(kickModelId),
							),
							systemPromptTokens: Math.ceil(composeInstructions(promptKind(freshRecord)).length / 4),
						};
					}, chatId);
			},
		});
		// The turn is now a live background object: register it so any view
		// can reattach (GET /api/chats/[id]/stream) or remotely abort it
		// (POST /api/activity/abort, kind "turn"). Registration after the
		// runPiTurn call is race-free: the agent loop only ticks in later
		// microtasks, so settle (and thus unregister) cannot beat us here.
		registerTurn(chatId, handle);
		// CONNECTION DIET B (owner, 2026-10-10 — the parallel-session freeze
		// postmortem): the POST no longer holds the turn's SSE stream open for
		// its whole duration. It acknowledges acceptance and CLOSES; the
		// submitter attaches through GET /api/chats/[id]/stream — the same
		// universal reattach wire a returning visitor uses. The browser's
		// 6-connections-per-origin pool is the scarce resource: a submission
		// must cost zero permanently-held slots beyond the one live view. The
		// turn itself is a server-side process (ruling 2026-09-25) — it never
		// needed this connection, only a view did.
		return Response.json({ ok: true });
	} catch (err) {
		// The stream never started, so no onFinish will fire — clear the registry
		// or a malformed request would lock the chat until the TTL eviction.
		endTurn(chatId);
		// Wave C: the live-agent registration (if it happened) dies with the
		// turn here too - nothing was handed (the loop never ticked).
		unregisterLiveAgent(chatId);
		console.error(`[chat ${chatId}] turn failed to start:`, err);
		return Response.json({ error: "Failed to start the turn" }, { status: 500 });
	}
}
