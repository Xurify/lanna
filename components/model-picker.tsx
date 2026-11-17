"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatSettings, ModelCatalogEntry, ModelCatalogResponse, ModelsSettings, UserSettings } from "@/src/core";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { modelName } from "@/components/model-names";
import { ModelMenuList, ThinkingMenuList } from "@/components/settings/model-menu";
import { composeSlotModel } from "@/components/settings/ai-section";
import { MenuShell } from "@/components/menu-shell";
import { Hint } from "@/components/ui/hint";
import { notifySettingsSaved, onSettingsSaved, useSettingsSaved } from "@/components/settings-signal";
import { defaultOrderLevel, populateLevel, thinkingLabel } from "@/components/thinking-default";

/** /api/models is cached per page load. The menu re-fetches on every open and swaps in the fresh list (stale-while-revalidate). */
let catalogCache: ModelCatalogResponse | undefined;
let catalogInflight: Promise<void> | undefined;
let catalogGeneration = 0;
let stopCatalogSignals: (() => void) | undefined;
const catalogReaders = new Set<() => void>();
const publishCatalog = () => {
	for (const reader of catalogReaders) reader();
};
function fetchCatalog(revalidate = false): void {
	if (revalidate) {
		catalogGeneration++;
		catalogInflight = undefined;
	}
	if (catalogInflight) return;
	const generation = catalogGeneration;
	catalogInflight = fetch("/api/models")
		.then((r) => {
			if (!r.ok) throw new Error(`catalog request failed: ${r.status}`);
			return r.json() as Promise<ModelCatalogResponse>;
		})
		.then((c) => {
			if (generation === catalogGeneration) {
				catalogCache = c;
				publishCatalog();
			}
		})
		.catch(() => {
			/* existing unavailable/usage-only posture, no retry timer */
		})
		.finally(() => {
			if (generation === catalogGeneration) catalogInflight = undefined;
		});
}
export function useModelCatalog(): { catalog: ModelCatalogResponse | undefined; refresh: () => void } {
	const [catalog, setCatalog] = useState(catalogCache);
	useEffect(() => {
		const first = catalogReaders.size === 0;
		const read = () => setCatalog(catalogCache);
		catalogReaders.add(read);
		if (first) {
			stopCatalogSignals = onSettingsSaved((section) => {
				if (section === "keys") {
					catalogGeneration++;
					catalogInflight = undefined;
					catalogCache = undefined;
					publishCatalog();
					fetchCatalog();
				} else if (section === "models") fetchCatalog(true);
			});
			fetchCatalog(true);
		} else fetchCatalog();
		read();
		return () => {
			catalogReaders.delete(read);
			if (!catalogReaders.size) {
				stopCatalogSignals?.();
				stopCatalogSignals = undefined;
			}
		};
	}, []);
	const refresh = useCallback(() => fetchCatalog(true), []);
	return { catalog, refresh };
}

/** provider:id → contextWindow from the cached catalog. pi's live catalog is the only limit source; a missing model reads null and the meter shows usage only. */
export function catalogLimits(catalog: Pick<ModelCatalogResponse, "models">): Map<string, number> {
	return new Map(catalog.models.map((m) => [`${m.provider}:${m.id}`, m.contextWindow]));
}

/**
 * The conversation model and thinking pills. With a chatId, they bind the
 * session's own record (GET/PUT /api/chats/:id/settings). A legacy session
 * with no stamped model falls back to the strong slot, as the engine does.
 * Without a chatId (draft surfaces), they bind the strong slot, so picking
 * here changes the new-session default. An unpicked model reads "—".
 */
export function ModelControl({
	chatId,
	onModelChange,
}: {
	chatId?: string;
	onModelChange?: (model: string | undefined) => void;
}) {
	const { catalog, refresh } = useModelCatalog();
	const [models, setModels] = useState<ModelsSettings | undefined>();
	const [session, setSession] = useState<ChatSettings | undefined>();
	const [open, setOpen] = useState<"model" | "thinking" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Runs on mount and on the models-saved signal, so another surface's write updates the pill.
	const readRecord = useCallback(() => {
		if (chatId) {
			fetch(`/api/chats/${chatId}`)
				.then((r) => r.json() as Promise<{ settings?: ChatSettings }>)
				.then((body) => setSession(body.settings))
				.catch(() => {
					/* same read-only posture as a models-section failure */
				});
		}
		fetch("/api/settings")
			.then((r) => r.json() as Promise<{ settings: { models?: ModelsSettings } | null }>)
			.then((body) => setModels(body.settings?.models ?? undefined))
			.catch(() => {
				/* a failed read leaves the control read-only */
			});
	}, [chatId]);

	useEffect(() => {
		readRecord();
	}, [readRecord]);

	useSettingsSaved((section) => {
		if (section === "models") readRecord();
	});

	// Chat mode falls back to the strong slot for legacy sessions, matching resolveConversationSpec.
	const strong = models?.strong;
	const override: ChatSettings | undefined = chatId
		? {
				model: session?.model ?? strong?.model,
				thinkingLevel: session?.thinkingLevel ?? strong?.thinkingLevel,
			}
		: strong;
	const effectiveId = override?.model?.id;
	const effectiveProvider = override?.model?.provider;
	useEffect(() => {
		onModelChange?.(effectiveProvider && effectiveId ? `${effectiveProvider}:${effectiveId}` : undefined);
	}, [effectiveProvider, effectiveId, onModelChange]);
	const storedLevel = override?.thinkingLevel;
	const entry = catalog?.models.find((m) => m.id === effectiveId && m.provider === effectiveProvider);
	const levels = entry?.supportedLevels ?? [];
	// A model with no stored level displays the resolved level, which is what the engine runs. Display only.
	const effectiveLevel = storedLevel ?? (entry ? defaultOrderLevel(levels) : undefined);

	// Outside click or Esc closes the open menu. The menu body is portaled to body,
	// so its rows are carved out via [data-lanna-menu]; otherwise a row's pointerdown counts as outside.
	useEffect(() => {
		if (open === null) return;
		const onPointerDown = (e: PointerEvent) => {
			const t = e.target as Element;
			if (t instanceof Element && t.closest("[data-lanna-menu]")) return;
			if (containerRef.current && !containerRef.current.contains(t)) {
				setOpen(null);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				// Claim Esc so the window-level chain does not also stop dictation or abort the turn.
				e.stopPropagation();
				setOpen(null);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	// composeSlotModel keeps the sibling slots intact when writing the strong slot.
	const save = useCallback(async (next: ModelsSettings) => {
		setError(null);
		try {
			const res = await fetch("/api/settings/models", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(next),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				setError(body.error ?? `settings rejected (${res.status})`);
				return;
			}
			// Show the stored value, which the server may have clamped.
			const stored = ((await res.json().catch(() => null)) as { settings?: UserSettings } | null)?.settings?.models;
			setModels(stored ?? next);
			setOpen(null);
			notifySettingsSaved("models");
		} catch {
			setError("Could not reach the server — try again.");
		}
	}, []);

	// Session write (chat mode). No notifySettingsSaved: no other surface reads one session's record.
	const saveChat = useCallback(
		async (next: ChatSettings) => {
			setError(null);
			try {
				const res = await fetch(`/api/chats/${chatId}/settings`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(next),
				});
				if (!res.ok) {
					const body = (await res.json().catch(() => ({}))) as { error?: string };
					setError(body.error ?? `settings rejected (${res.status})`);
					return;
				}
				const stored = (await res.json().catch(() => null)) as { settings?: ChatSettings } | null;
				setSession(stored?.settings ?? next);
				setOpen(null);
			} catch {
				setError("Could not reach the server — try again.");
			}
		},
		[chatId],
	);

	// One apply seam over both write paths.
	const apply = useCallback(
		(provider: string, id: string, level: ThinkingLevel | undefined) => {
			if (chatId) {
				void saveChat({ model: { provider, id }, thinkingLevel: level });
			} else {
				// composeSlotModel's empty-string convention: no level = unset.
				void save(composeSlotModel(models, "strong", provider, id, level ?? ""));
			}
		},
		[chatId, models, save, saveChat],
	);

	// ⌘K opens the model menu. Shift+Tab cycles the thinking level, wrapping. Both work mid-typing.
	useEffect(() => {
		const onOpenPicker = () => {
			setOpen("model");
			setError(null);
			refresh();
		};
		window.addEventListener("lanna:kbd-open-model-picker", onOpenPicker);
		return () => window.removeEventListener("lanna:kbd-open-model-picker", onOpenPicker);
	}, [refresh]);

	useEffect(() => {
		const onCycleThinking = () => {
			if (levels.length === 0) return;
			const idx = effectiveLevel === undefined ? -1 : levels.indexOf(effectiveLevel);
			const next = levels[(idx + 1) % levels.length];
			if (next === undefined) return;
			apply(effectiveProvider ?? "", effectiveId ?? "", next);
		};
		window.addEventListener("lanna:kbd-cycle-thinking", onCycleThinking);
		return () => window.removeEventListener("lanna:kbd-cycle-thinking", onCycleThinking);
	}, [levels, effectiveLevel, effectiveProvider, effectiveId, apply]);

	// A fresh pick always writes a level. The stored level rides along; the server clamps it
	// if the new model lacks it. The derived display level never rides, since it belongs to the old model.
	const pickModel = (m: ModelCatalogEntry) => {
		const nextLevel = populateLevel(storedLevel, m.supportedLevels);
		apply(m.provider, m.id, nextLevel);
	};

	const openMenu = (kind: "model" | "thinking") => {
		setOpen((o) => (o === kind ? null : kind));
		setError(null);
		if (kind === "model") refresh();
	};

	return (
		<div ref={containerRef} className="relative flex items-center gap-1.5" data-testid="model-control">
			<Hint
				// ⌘K opens this same menu.
				label="Model selector"
				action="open-model-picker"
				side="bottom"
			>
				<button
					type="button"
					data-testid="stats-model"
					onClick={() => openMenu("model")}
					aria-expanded={open === "model"}
					// Matches the graph's floating buttons, so the graph does not bleed through.
					className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 shadow-raise transition-colors hover:bg-well"
				>
					<span className="text-card-foreground">
						<span className="inline-block min-w-[6.5rem] text-center">
							{effectiveId
								? modelName(catalog?.models, effectiveProvider, effectiveId)
								: catalog
									? "No model"
									: "Model"}
						</span>
					</span>
					<span aria-hidden className="text-xs text-muted-foreground">
						▾
					</span>
				</button>
			</Hint>
			<Hint
				// Shows the rebindable ⇧⇥ shortcut.
				label="Thinking"
				action="cycle-thinking"
				side="bottom"
			>
				<button
					type="button"
					data-testid="stats-thinking"
					onClick={() => {
						// No model picked: nothing to set a level for.
						if (entry === undefined) return;
						openMenu("thinking");
					}}
					aria-expanded={open === "thinking"}
					// Matches the graph's floating buttons, so the graph does not bleed through.
					className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 shadow-raise transition-colors hover:bg-well"
				>
					{/* Just the level, as the model button shows just the model name. */}
					<span className="text-card-foreground">
						<span className="inline-block min-w-16 text-center">
							{effectiveLevel === undefined
								? effectiveId
									? "Thinking"
									: "Thinking off"
								: thinkingLabel(effectiveLevel)}
						</span>
					</span>
					<span aria-hidden className="text-xs text-muted-foreground">
						▾
					</span>
				</button>
			</Hint>

			{open === "model" && (
				<MenuShell
					anchorRef={containerRef}
					testid="model-menu"
					preferredSide="up"
					menuClass="flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col rounded-xl border bg-card p-2 text-xs shadow-xl"
				>
					{error && <div className="mb-1.5 text-destructive">{error}</div>}
					<ModelMenuList
						models={catalog?.models}
						effectiveId={effectiveId}
						effectiveProvider={effectiveProvider}
						onPick={pickModel}
						footer={
							catalog && catalog.models.length === 0
								? "No models — add a provider key in Settings → API keys"
								: chatId
									? "This chat's model"
									: "The default for new chats"
						}
					/>
				</MenuShell>
			)}

			{open === "thinking" && (
				<MenuShell
					anchorRef={containerRef}
					testid="thinking-menu"
					preferredSide="up"
					menuClass="flex w-44 flex-col gap-0.5 rounded-xl border bg-card p-2 text-xs shadow-xl"
				>
					<ThinkingMenuList
						levels={catalog ? levels : []}
						effectiveLevel={effectiveLevel}
						onPick={(level) => apply(effectiveProvider ?? "", effectiveId ?? "", level as ThinkingLevel)}
						empty={
							catalog
								? effectiveId
									? `${modelName(catalog?.models, effectiveProvider, effectiveId)} has no thinking levels.`
									: "Pick a model first."
								: "Loading…"
						}
						footer="Levels this model supports"
					/>
					{error && <div className="mt-1 text-destructive">{error}</div>}
				</MenuShell>
			)}
		</div>
	);
}
