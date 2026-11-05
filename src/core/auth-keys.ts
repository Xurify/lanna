/**
 * The curated auth-key catalog and shape rules. Pure and browser-safe.
 * Validation is shape-only (no live provider pings).
 * Keys are identified by their env-var name, which is also the auth.json key.
 * Unknown file vars are preserved and shown as generic rows, but are not writable through the curated API.
 */

/** One curated key entry. `id` is the env-var/file key name. */
export interface AuthKeyInfo {
	id: string;
	label: string;
	description: string;
	/** Where to get a key; opens in the system browser. */
	docsUrl: string;
	/** A plain setting, not a secret: edited as visible text and its value is shown in status. */
	plain?: boolean;
}

export const AUTH_KEYS: readonly AuthKeyInfo[] = [
	{
		id: "ELEVENLABS_API_KEY",
		label: "ElevenLabs",
		description: "Premium speech for the language you are learning (first tier of the TTS cascade). Without it the app uses free Edge voices.",
		docsUrl: "https://elevenlabs.io/app/settings/api-keys",
	},
	{
		id: "DEEPGRAM_API_KEY",
		label: "Deepgram",
		description: "Speech-to-text key for dictation — needs ≥ Member permission in the Deepgram console to mint tokens.",
		docsUrl: "https://console.deepgram.com/",
	},
	{
		id: "AZURE_SPEECH_KEY",
		label: "Azure Speech",
		description: "Pronunciation assessment for Speak and Say it faster: a sound-level score for every line you say (most European languages are covered). Needs the region below too. Without it, clarity is judged from the words speech-to-text could make out.",
		docsUrl: "https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices",
	},
	{
		id: "AZURE_SPEECH_REGION",
		label: "Azure Speech region",
		description: "The region of your Azure Speech resource, e.g. westeurope or germanywestcentral.",
		docsUrl: "https://learn.microsoft.com/azure/ai-services/speech-service/regions",
		plain: true,
	},
	{
		id: "TAVILY_API_KEY",
		label: "Tavily",
		description: "Web-search engine for the researcher sub-agent (AI-native search API). Setting the key activates it — no engine toggle needed.",
		docsUrl: "https://app.tavily.com/",
	},
	{
		id: "BRAVE_API_KEY",
		label: "Brave Search",
		description: "Web-search engine for the researcher sub-agent — the alternative to Tavily. Setting the key activates it.",
		docsUrl: "https://brave.com/search/api/",
	},
] as const;

const AUTH_KEY_IDS: ReadonlySet<string> = new Set(AUTH_KEYS.map((k) => k.id));

export function isKnownAuthKey(id: string): boolean {
	return AUTH_KEY_IDS.has(id);
}

export function isPlainAuthSetting(id: string): boolean {
	return AUTH_KEYS.some((k) => k.id === id && k.plain === true);
}

/** A model-provider key row: pi-ai provider id, its key's env var, and label. */
export interface AuthProviderInfo {
	id: string;
	envVar: string;
	label: string;
}

/**
 * Every pi-ai provider that takes a plain api-key env var. tests/auth-provider-keys.test.ts
 * re-derives this from pi-ai and asserts exact equality, so a pi-ai change fails loudly.
 * Excluded (not plain keys): github-copilot, amazon-bedrock, google-vertex, azure, cloudflare.
 * Anthropic keeps only ANTHROPIC_API_KEY. Providers sharing an env var keep separate rows.
 */
export const AUTH_PROVIDER_KEYS: readonly AuthProviderInfo[] = [
	{ id: "ant-ling", envVar: "ANT_LING_API_KEY", label: "Ant Ling" },
	{ id: "anthropic", envVar: "ANTHROPIC_API_KEY", label: "Anthropic" },
	{ id: "baseten", envVar: "BASETEN_API_KEY", label: "Baseten" },
	{ id: "cerebras", envVar: "CEREBRAS_API_KEY", label: "Cerebras" },
	{ id: "deepseek", envVar: "DEEPSEEK_API_KEY", label: "DeepSeek" },
	{ id: "fireworks", envVar: "FIREWORKS_API_KEY", label: "Fireworks" },
	{ id: "google", envVar: "GEMINI_API_KEY", label: "Google" },
	{ id: "groq", envVar: "GROQ_API_KEY", label: "Groq" },
	{ id: "huggingface", envVar: "HF_TOKEN", label: "Hugging Face" },
	{ id: "kimi-coding", envVar: "KIMI_API_KEY", label: "Kimi For Coding" },
	{ id: "meta", envVar: "META_API_KEY", label: "Meta" },
	{ id: "minimax", envVar: "MINIMAX_API_KEY", label: "MiniMax" },
	{ id: "minimax-cn", envVar: "MINIMAX_CN_API_KEY", label: "MiniMax CN" },
	{ id: "mistral", envVar: "MISTRAL_API_KEY", label: "Mistral" },
	{ id: "moonshotai", envVar: "MOONSHOT_API_KEY", label: "Moonshot AI" },
	{ id: "moonshotai-cn", envVar: "MOONSHOT_API_KEY", label: "Moonshot AI CN" },
	{ id: "nvidia", envVar: "NVIDIA_API_KEY", label: "NVIDIA" },
	{ id: "openai", envVar: "OPENAI_API_KEY", label: "OpenAI" },
	{ id: "opencode", envVar: "OPENCODE_API_KEY", label: "OpenCode Zen" },
	{ id: "opencode-go", envVar: "OPENCODE_API_KEY", label: "OpenCode Go" },
	{ id: "openrouter", envVar: "OPENROUTER_API_KEY", label: "OpenRouter" },
	{ id: "qwen-token-plan", envVar: "QWEN_TOKEN_PLAN_API_KEY", label: "Qwen Token Plan" },
	{ id: "qwen-token-plan-cn", envVar: "QWEN_TOKEN_PLAN_CN_API_KEY", label: "Qwen Token Plan CN" },
	{ id: "qwen-token-plan-individual", envVar: "QWEN_TOKEN_PLAN_API_KEY", label: "Qwen Token Plan Individual" },
	{ id: "radius", envVar: "RADIUS_API_KEY", label: "Radius" },
	{ id: "together", envVar: "TOGETHER_API_KEY", label: "Together" },
	{ id: "typesafe", envVar: "TYPESAFE_API_KEY", label: "TypeSafe" },
	{ id: "vercel-ai-gateway", envVar: "AI_GATEWAY_API_KEY", label: "Vercel AI Gateway" },
	{ id: "xai", envVar: "XAI_API_KEY", label: "xAI" },
	{ id: "xiaomi", envVar: "XIAOMI_API_KEY", label: "Xiaomi" },
	{ id: "xiaomi-token-plan-ams", envVar: "XIAOMI_TOKEN_PLAN_AMS_API_KEY", label: "Xiaomi Token Plan AMS" },
	{ id: "xiaomi-token-plan-cn", envVar: "XIAOMI_TOKEN_PLAN_CN_API_KEY", label: "Xiaomi Token Plan CN" },
	{ id: "xiaomi-token-plan-sgp", envVar: "XIAOMI_TOKEN_PLAN_SGP_API_KEY", label: "Xiaomi Token Plan SGP" },
	{ id: "zai", envVar: "ZAI_API_KEY", label: "Z.AI" },
	{ id: "zai-coding-cn", envVar: "ZAI_CODING_CN_API_KEY", label: "Z.AI Coding CN" },
] as const;

/** Distinct env vars of the model-provider keys. */
export const AUTH_PROVIDER_ENV_VARS: ReadonlySet<string> = new Set(AUTH_PROVIDER_KEYS.map((p) => p.envVar));

/** Is this env-var name the key of SOME pi-ai model provider? */
export function isProviderEnvVar(envVar: string): boolean {
	return AUTH_PROVIDER_ENV_VARS.has(envVar);
}

/** Shape-check result: ok, or a 400-ready message naming the expectation. */
export type KeyShapeResult = { ok: true } | { ok: false; error: string };

/**
 * Write-side shape gate: bad pastes are rejected with 400 and never stored.
 * Values are trimmed first; empty-after-trim always fails. Model-provider keys use genericProviderKeyGuard.
 */
export function validateKeyShape(id: string, rawValue: string): KeyShapeResult {
	const value = rawValue.trim();
	const nonEmpty = (min: number) =>
		value.length >= min && !/\s/.test(value)
			? { ok: true as const }
			: { ok: false as const, error: `${id} must be at least ${min} characters with no whitespace` };
	switch (id) {
		case "TAVILY_API_KEY":
			return value.startsWith("tvly-")
				? nonEmpty(20)
				: { ok: false, error: `${id} must start with "tvly-" (Tavily's key format)` };
		case "BRAVE_API_KEY":
			// No public format — a length floor + paste hygiene only.
			return nonEmpty(20);
		case "ELEVENLABS_API_KEY":
			// "sk_" + hex today; older keys were bare hex — length floor only.
			return nonEmpty(20);
		case "DEEPGRAM_API_KEY":
			// No public format — the length floor only catches truncated pastes.
			return nonEmpty(20);
		case "AZURE_SPEECH_KEY":
			// 32 hex characters today; a length floor only.
			return nonEmpty(20);
		case "AZURE_SPEECH_REGION":
			return /^[a-z0-9]{4,40}$/.test(value) ? { ok: true } : { ok: false, error: `${id} must be a region name such as westeurope (lowercase letters and digits)` };
		default:
			return { ok: false, error: `unknown key "${id}" (supported: ${[...AUTH_KEY_IDS].join(", ")})` };
	}
}

/** Truncation guard for model-provider keys: trimmed, no whitespace, at least 12 chars. */
export function genericProviderKeyGuard(id: string, rawValue: string): KeyShapeResult {
	const value = rawValue.trim();
	if (value.length >= 12 && !/\s/.test(value)) return { ok: true };
	return { ok: false, error: `${id} must be at least 12 characters with no whitespace` };
}

/** Masked key for display: last 4 characters, never the plaintext. */
export function maskKey(value: string): string {
	const v = value.trim();
	if (v.length <= 4) return `…${v}`; // degenerate paste — still never the whole value
	return `…${v.slice(-4)}`;
}

/** One key's status row for the GET view (never carries plaintext). */
export interface AuthKeyStatus {
	id: string;
	/** Catalog metadata when the key is curated; null for unknown-file-var
	 *  entries (preserved + surfaced, but no curated form to edit through). */
	info: AuthKeyInfo | null;
	/** A key is present when EITHER the environment or the file has it. */
	present: boolean;
	/** The masked tail + character count, e.g. "…ab12 (64 chars)". */
	masked: string | null;
	/** Where the live value comes from, given env-wins precedence. */
	source: "env" | "file" | "none";
	/** True when the file holds a value that the environment shadows — the
	 *  settings page explains why a saved key is not the live one. */
	shadowedByEnv: boolean;
	/** When the app last saved this file-held key (ISO time). Null for env keys and keys with no recorded time. */
	savedAt?: string | null;
	/** Live value of a plain setting (the only status carrying plaintext). Absent for secrets and unset settings. */
	value?: string;
}
