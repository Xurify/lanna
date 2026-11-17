import {
	createChatAgent,
	createPracticeAgent,
	type AgentBuildOptions,
	type TeachingAgent,
} from "../../agent/teacher-agent.ts";
import { piEngineForSpec, type PiEngine } from "../../agent/models.ts";
import type { SourceToolContext } from "../../agent/tools/sources.ts";
import { slovakLookup } from "../../agent/lexicon.ts";
import { activeProfile, type ModelRole } from "../../../config.ts";
import { asAgentMessages, type LannaMessage } from "../../core/chat-messages.ts";
import type { ChatRecord } from "../../core/contracts/chat.ts";
import { checkerNote, checkSlovak } from "../../core/slovak-check.ts";
import { resolveRoleSpec, type EffectiveSettings } from "../../core/settings-resolution.ts";
import { appContentNow } from "../app-content.ts";
import { recordChatAnswer } from "../chat-evidence.ts";
import { drawForReply, latestReplyText } from "../drawing.ts";
import { providerKeyPresent } from "../keys.ts";
import { enqueueWords, reviewDigest } from "../review.ts";
import { searchProvider } from "../search.ts";
import { stores } from "../stores.ts";
import { callUsageOf, type TurnUsageLedger } from "./usage.ts";

export type AgentFactory = (opts: AgentBuildOptions & { kind?: ChatRecord["kind"] }) => TeachingAgent;

export interface TurnAgentPlan {
	chatId: string;
	kind: ChatRecord["kind"];
	engine: PiEngine;
	messages: LannaMessage[];
	usage: TurnUsageLedger;
	settings: EffectiveSettings;
}

const reviewSeam = {
	enqueue: (slugs: string[]) => enqueueWords(slugs),
	digest: () => reviewDigest(),
};

function slovakNoteFor(text: string): string | null {
	return checkerNote(checkSlovak(text, slovakLookup() ?? undefined));
}

function chatCheckerNote(text: string): string | null {
	if (activeProfile() !== "slovak" || text.startsWith("[")) return null;
	return slovakNoteFor(text);
}

function chatAppContent(chatId: string): string | undefined {
	try {
		return appContentNow();
	} catch (err) {
		console.error(`[chat ${chatId}] the app's content map could not be read:`, err);
		return "# What the app has\n\nNot available this turn: say you cannot look up the app's lessons right now.";
	}
}

export function withSlovakEvidence(message: LannaMessage): LannaMessage {
	if (activeProfile() !== "slovak" || message.role !== "custom" || message.customType !== "practice-thinking") {
		return message;
	}
	const text = (message.details as { text?: string } | undefined)?.text;
	const note = text ? slovakNoteFor(text) : null;
	return note ? { ...message, content: `${message.content}\n\n${note}` } : message;
}

function resolveEngine(role: ModelRole): PiEngine | undefined {
	const spec = resolveRoleSpec(role, stores.settingsStore.readSettings());
	return spec ? piEngineForSpec(spec) : undefined;
}

function sourcesFor(chatId: string, usage: TurnUsageLedger): SourceToolContext {
	return {
		chatId,
		engineFor: (reader) => resolveEngine(reader === "research" ? "researcher" : "pdfReader"),
		cannotRun: (readerEngine) =>
			providerKeyPresent(readerEngine.model.provider) ? null : "its model's provider has no key (Settings → API keys)",
		search: searchProvider,
		recordUsage: (model, steps) =>
			stores.chatStore.appendTurnUsage(chatId, {
				id: crypto.randomUUID(),
				messageId: `reader_${usage.id}`,
				at: new Date().toISOString(),
				model,
				steps: steps.map(callUsageOf),
			}),
	};
}

function agentOptionsOf(plan: TurnAgentPlan): AgentBuildOptions {
	return {
		engine: plan.engine,
		messages: asAgentMessages(plan.messages),
		onUsage: plan.usage.collect,
		toolToggles: plan.settings.agent.tools,
		chatId: plan.chatId,
		promptSwitches: plan.settings.agent.prompts,
	};
}

function practiceAgentOf(plan: TurnAgentPlan, options: AgentBuildOptions): TeachingAgent {
	return createPracticeAgent(
		{
			chatId: plan.chatId,
			chatStore: stores.chatStore,
			sources: sourcesFor(plan.chatId, plan.usage),
			review: reviewSeam,
		},
		options,
	);
}

function chatAgentOf(plan: TurnAgentPlan, options: AgentBuildOptions): TeachingAgent {
	const agent: TeachingAgent = createChatAgent(
		{
			review: reviewSeam,
			answers: {
				record: (answer) => recordChatAnswer({ ...answer, at: new Date().toISOString(), chatId: plan.chatId }),
			},
			drawing: {
				draw: (brief, signal) =>
					drawForReply({
						engine: plan.engine,
						reply: latestReplyText(agent.state.messages),
						brief,
						signal,
						onUsage: plan.usage.collect,
						chatId: plan.chatId,
					}),
			},
			sources: sourcesFor(plan.chatId, plan.usage),
		},
		{ ...options, noteLearnerText: chatCheckerNote, appContent: chatAppContent(plan.chatId) },
	);
	return agent;
}

export function buildTurnAgent(plan: TurnAgentPlan, buildAgent?: AgentFactory): TeachingAgent {
	const options = agentOptionsOf(plan);
	if (buildAgent) return buildAgent({ ...options, kind: plan.kind });
	return plan.kind === "practice" ? practiceAgentOf(plan, options) : chatAgentOf(plan, options);
}
