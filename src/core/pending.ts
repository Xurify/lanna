export const TOGGLEABLE_TOOLS = ["research", "pdf"] as const;

export const RETIRED_TOOL_KEYS = ["visual"] as const;

export const WRITABLE_TOOL_KEYS = TOGGLEABLE_TOOLS;

export type EnabledTools = Partial<Record<string, boolean>>;

export function filterToggleableTools<T>(tools: Record<string, T>, enabled?: EnabledTools): Record<string, T> {
	if (!enabled) return tools;
	const out = { ...tools };
	for (const name of TOGGLEABLE_TOOLS) if (enabled[name] === false) delete out[name];
	return out;
}

const ACTIVITY_LABELS: Record<string, string> = {
	read: "Reading a file…",
	research: "Researching…",
	pdf: "Reading a PDF…",
};

export function toolActivityLabel(tool: string): string {
	return ACTIVITY_LABELS[tool] ?? "Working…";
}
