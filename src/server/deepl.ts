/**
 * DeepL text translation, used by word lookup when DEEPL_API_KEY is set.
 * Returns null on any failure (no key, bad key 403, quota 456, timeout,
 * unsupported language) so the caller falls through to its next tier.
 */

import { keyValue } from "./keys.ts";

/** DeepL routes Free keys (suffix ":fx") to a separate host; a Free key sent to the Pro host gets 403. */
export function deeplEndpoint(key: string): string {
	return key.trim().endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
}

/** DeepL rejects plain "EN" as a target and wants a regional variant. */
const DEEPL_TARGET = "EN-US";

export async function deeplTranslate(text: string, sourceCode: string, timeoutMs = 2500): Promise<string | null> {
	const key = keyValue("DEEPL_API_KEY")?.trim();
	if (!key) return null;
	try {
		const response = await fetch(deeplEndpoint(key), {
			method: "POST",
			headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				text: [text],
				source_lang: sourceCode.toUpperCase(),
				target_lang: DEEPL_TARGET,
			}),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) return null;
		const data = (await response.json()) as { translations?: Array<{ text?: unknown }> };
		const translated = data.translations?.[0]?.text;
		return typeof translated === "string" && translated.trim() ? translated.trim() : null;
	} catch {
		return null;
	}
}
