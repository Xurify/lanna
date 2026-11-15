/**
 * How a model reads to a learner: the catalog's own name, the provider's
 * label and the price line. Every model picker and usage chip uses these, so
 * one model shows the same words everywhere.
 */
import { AUTH_PROVIDER_KEYS, type ModelCatalogEntry } from "@/src/core";
import { prettyModel } from "@/components/usage-format";

export function providerLabel(id: string): string {
	return AUTH_PROVIDER_KEYS.find((p) => p.id === id)?.label ?? id;
}

export function priceLabel(cost: ModelCatalogEntry["cost"]): string {
	return `$${cost.input.toFixed(2)} in · $${cost.output.toFixed(2)} out`;
}

/** The catalog's name for the model; the id, tidied, when the catalog does not list it. */
export function modelName(
	catalog: readonly ModelCatalogEntry[] | null | undefined,
	provider: string | undefined,
	id: string,
): string {
	const entry = catalog?.find((m) => m.id === id && (provider === undefined || m.provider === provider));
	return entry?.name ?? prettyModel(id);
}

/** A usage stamp, "provider:id", as a learner reads it: "Claude Haiku 5.5 · Anthropic". */
export function stampModelLabel(catalog: readonly ModelCatalogEntry[] | null | undefined, stamp: string): string {
	const colon = stamp.indexOf(":");
	const provider = colon === -1 ? undefined : stamp.slice(0, colon);
	const id = colon === -1 ? stamp : stamp.slice(colon + 1);
	return provider === undefined
		? modelName(catalog, undefined, id)
		: `${modelName(catalog, provider, id)} · ${providerLabel(provider)}`;
}
