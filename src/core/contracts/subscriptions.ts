export const SUBSCRIPTIONS = [
	{ id: "chatgpt", label: "ChatGPT" },
	{ id: "github-copilot-subscription", label: "GitHub Copilot" },
	{ id: "xai-subscription", label: "Grok" },
] as const;

export type SubscriptionId = (typeof SUBSCRIPTIONS)[number]["id"];

export interface SubscriptionLogin {
	url?: string;
	userCode?: string;
	message?: string;
	prompt?: {
		type: "text" | "secret" | "select" | "manual_code";
		message: string;
		placeholder?: string;
		options?: readonly { id: string; label: string }[];
	};
}

export interface SubscriptionStatus {
	id: SubscriptionId;
	label: string;
	connected: boolean;
	account?: string;
	login?: SubscriptionLogin;
	error?: string;
}
