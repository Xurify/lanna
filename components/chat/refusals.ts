import { isProviderKeyRefusal, type ModelSlotName } from "@/src/core";

export function parseModelsRefusal(message: string | undefined): ModelSlotName[] | null {
	if (!message) return null;
	try {
		const body = JSON.parse(message) as { code?: unknown; missing?: unknown };
		if (
			body.code === "models_not_configured" &&
			Array.isArray(body.missing) &&
			body.missing.every((slot) => typeof slot === "string")
		) {
			return body.missing as ModelSlotName[];
		}
		return null;
	} catch {
		return null;
	}
}

export function parseProviderKeyRefusal(message: string | undefined): boolean {
	if (!message) return false;
	try {
		const body = JSON.parse(message) as { code?: unknown; error?: unknown };
		return body.code === "provider_key_missing" && typeof body.error === "string" && isProviderKeyRefusal(body.error);
	} catch {
		return false;
	}
}
