export const SUBSCRIPTIONS = [
	{ id: "chatgpt", label: "ChatGPT" },
	{ id: "github-copilot-subscription", label: "GitHub Copilot" },
	{ id: "xai-subscription", label: "Grok" },
] as const;

export type SubscriptionId = (typeof SUBSCRIPTIONS)[number]["id"];

/** What a sign-in in progress asks of the learner. Tokens never enter this contract. */
export interface SubscriptionLogin {
	/** The page to sign in on. */
	url?: string;
	/** The code to type on that page (Copilot, Grok). */
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
	/** The signed-in account, when the provider's token names one (ChatGPT). */
	account?: string;
	login?: SubscriptionLogin;
	error?: string;
}
