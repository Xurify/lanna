import { piEngineForSpec, type PiEngine } from "../../agent/models.ts";
import { composeInstructions } from "../../agent/teacher-agent.ts";
import type { ChatRecord } from "../../core/contracts/chat.ts";
import { resolveConversationSpec, type EffectiveSettings } from "../../core/settings-resolution.ts";
import { modelsNotConfigured, providerKeyMissing } from "../../core/settings.ts";
import { ensureCompacted, effectiveThresholdTokens, kickCompaction, type CompactionDeps } from "../compaction.ts";
import { providerKeyPresent } from "../keys.ts";
import { catalogContextLimits } from "../model-catalog.ts";
import { effectiveSettings, stores } from "../stores.ts";

const CHARS_PER_TOKEN_ESTIMATE = 4;

type ConversationSpec = NonNullable<ReturnType<typeof resolveConversationSpec>>;
type RefusalEnvelope = ReturnType<typeof modelsNotConfigured> | ReturnType<typeof providerKeyMissing>;

export interface OpenTurn {
	record: ChatRecord;
	engine: PiEngine;
	settings: EffectiveSettings;
}

export type TurnGateOutcome = { outcome: "open"; turn: OpenTurn } | { outcome: "refused"; response: Response };

export function unknownChatResponse(): Response {
	return Response.json({ error: "Unknown chat" }, { status: 404 });
}

export function modelIdOf(engine: PiEngine): string {
	return `${engine.model.provider}:${engine.model.id}`;
}

function engineOf(spec: ConversationSpec): PiEngine | undefined {
	try {
		return piEngineForSpec(spec);
	} catch {
		return undefined;
	}
}

function systemPromptTokensOf(): number {
	return Math.ceil(composeInstructions("chat").length / CHARS_PER_TOKEN_ESTIMATE);
}

function compactionDepsFor(engine: PiEngine, thresholdSetting: number | undefined): CompactionDeps {
	const modelId = modelIdOf(engine);
	return {
		chatStore: stores.chatStore,
		engine,
		modelId,
		thresholdTokens: effectiveThresholdTokens(thresholdSetting, catalogContextLimits().get(modelId)),
		systemPromptTokens: systemPromptTokensOf(),
	};
}

function refused(chatId: string, envelope: RefusalEnvelope): TurnGateOutcome {
	console.info(`[chat ${chatId}] turn refused — ${JSON.stringify(envelope)}`);
	return { outcome: "refused", response: Response.json(envelope, { status: 503 }) };
}

export async function passTurnGates(chatId: string, record: ChatRecord): Promise<TurnGateOutcome> {
	const settings = effectiveSettings();
	const spec = resolveConversationSpec(record.settings, settings.models.strong);
	if (!spec) return refused(chatId, modelsNotConfigured(["strong"]));
	if (!providerKeyPresent(spec.provider)) return refused(chatId, providerKeyMissing(spec.provider, ["strong"]));
	const engine = engineOf(spec);
	if (!engine) {
		return {
			outcome: "refused",
			response: Response.json({ error: "The selected model is unavailable." }, { status: 503 }),
		};
	}
	await ensureCompacted(compactionDepsFor(engine, settings.compaction?.thresholdTokens), chatId);
	const compacted = stores.chatStore.getChat(chatId);
	if (!compacted) return { outcome: "refused", response: unknownChatResponse() };
	return { outcome: "open", turn: { record: compacted, engine, settings } };
}

export function kickCompactionAfterSettle(chatId: string): void {
	kickCompaction(() => {
		const settings = effectiveSettings();
		const record = stores.chatStore.getChat(chatId);
		if (!record) return null;
		const spec = resolveConversationSpec(record.settings, settings.models.strong);
		const engine = spec ? engineOf(spec) : undefined;
		if (!engine) return null;
		return compactionDepsFor(engine, settings.compaction?.thresholdTokens);
	}, chatId);
}
