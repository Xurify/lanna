import type { Usage } from "@earendil-works/pi-ai";
import type { CallUsage } from "../../core/contracts.ts";

export interface TurnUsageLedger {
	readonly id: string;
	readonly steps: CallUsage[];
	readonly collect: (usage: Usage) => void;
}

export function createTurnUsage(): TurnUsageLedger {
	const steps: CallUsage[] = [];
	return {
		id: crypto.randomUUID(),
		steps,
		collect: (usage) => {
			steps.push(callUsageOf(usage));
		},
	};
}

// pi-ai leaves cacheWrite1h and reasoning optional on Usage.
export function callUsageOf(usage: Usage): CallUsage {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		cacheReadTokens: usage.cacheRead,
		cacheWriteTokens: usage.cacheWrite,
		cacheWrite1hTokens: usage.cacheWrite1h ?? 0,
		reasoningTokens: usage.reasoning ?? 0,
	};
}
