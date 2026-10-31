"use client";
/**
 * The shared dropdown machinery for the settings menus, with the same look as
 * the chat model selector: fuzzy search, arrow-walk and Enter to pick. Each
 * mount owns only its popover shell (positioning, outside-click, Esc).
 *
 * Focus stays in the search field. Arrows walk the results (clamped, no wrap),
 * Enter picks the walked row or the first result. Keys stop propagating while
 * the menu is open.
 */

import { useEffect, useRef, useState } from "react";
import type { ModelCatalogEntry } from "@/src/core";
import { fuzzyScore, subscriptionLabel } from "@/src/core";
import { formatTokens } from "@/components/usage-format";
import { cn } from "@/lib/utils";

function priceLabel(cost: ModelCatalogEntry["cost"]): string {
	const fmt = (n: number) => `$${n < 1 ? n.toFixed(2).replace(/0$/, "") : n.toFixed(2)}`;
	return `${fmt(cost.input)}/${fmt(cost.output)}`;
}

/** Hover and the keyboard highlight take bg-accent. The chosen row never takes a fill; it carries a go-coloured check. */
export function MenuOption({
	highlighted = false,
	className,
	...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
	/** The keyboard highlight (the walk with the arrow keys). */
	highlighted?: boolean;
}) {
	return (
		<button
			type="button"
			{...props}
			className={cn(
				"rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-foreground",
				highlighted && "bg-accent text-foreground ring-1 ring-inset ring-foreground/25",
				className,
			)}
		/>
	);
}

/** The model dropdown body: fuzzy search and a ranked list. `models === undefined` is the loading state. */
export function ModelMenuList({
	models,
	effectiveId,
	effectiveProvider,
	onPick,
	footer,
}: {
	/** The full catalog — undefined while it loads. */
	models: ModelCatalogEntry[] | undefined;
	/** Currently effective id (the row gets the quiet highlight). */
	effectiveId: string | undefined;
	/** Provider of the effective id. The federated catalog can repeat ids, so the highlight must match both. */
	effectiveProvider?: string;
	/** Receives the chosen entry. */
	onPick: (entry: ModelCatalogEntry) => void;
	/** Quiet footer note under the list (context-specific). */
	footer?: string;
}) {
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	// Keep the arrow-walked result visible in the scrolling list.
	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	const results = (models ?? [])
		.map((m) => ({ m, s: fuzzyScore(query, m.provider, m.id, m.name) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.m.id.localeCompare(b.m.id))
		.map((r) => r.m);

	return (
		<>
			<input
				ref={searchRef}
				data-testid="model-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null); // new query → the walk restarts on Enter/↓
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (results.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, results.length - 1)
								: Math.max((i ?? results.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = results[menuIdx ?? 0];
						if (chosen) {
							e.preventDefault();
							e.stopPropagation();
							onPick(chosen);
						}
					}
				}}
				placeholder="Search models…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{!models && <div className="px-2 py-3 text-center text-muted-foreground">Loading models…</div>}
			{models && results.length === 0 && (
				<div className="px-2 py-3 text-center text-muted-foreground">No models match.</div>
			)}
			<ul ref={listRef} data-testid="model-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{results.map((m, i) => (
					<li key={`${m.provider}/${m.id}`}>
						<MenuOption
							data-testid={`model-option-${m.id.replace(/[^a-z0-9-]/gi, "_")}`}
							data-idx={i}
							onClick={() => onPick(m)}
							highlighted={i === menuIdx}
							className="flex w-full flex-col gap-0.5 outline-none"
						>
							<span className="flex items-center justify-between gap-2">
								<span className={`truncate ${m.id === effectiveId && m.provider === (effectiveProvider ?? m.provider) ? "text-go" : "text-card-foreground"}`}>{m.name}</span>
								<span className="shrink-0 tabular-nums text-muted-foreground" title={subscriptionLabel(`${m.provider}:${m.id}`) ? "Subscription connection" : "USD per 1M tokens in/out"}>
									{subscriptionLabel(`${m.provider}:${m.id}`) ?? priceLabel(m.cost)}
								</span>
							</span>
							<span className="flex items-center justify-between gap-2 text-muted-foreground">
								<span className="truncate">{subscriptionLabel(`${m.provider}:${m.id}`) ? `${subscriptionLabel(`${m.provider}:${m.id}`)} (subscription)` : m.provider} · {m.id}</span>
								<span className="shrink-0 tabular-nums">{formatTokens(m.contextWindow)}</span>
							</span>
						</MenuOption>
					</li>
				))}
			</ul>
			{footer && (
				<div className="mt-1 border-t px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>
			)}
		</>
	);
}

/** The thinking-level dropdown body: the levels the model supports, with a check on the effective one. */
export function ThinkingMenuList({
	levels,
	effectiveLevel,
	onPick,
	empty,
	footer,
}: {
	levels: string[];
	effectiveLevel: string | undefined;
	onPick: (level: string) => void;
	/** Shown instead of the list when there are no levels. */
	empty?: string;
	footer?: string;
}) {
	return (
		<>
			{levels.length === 0 ? (
				<div className="px-2 py-3 text-center text-muted-foreground">{empty ?? "No thinking levels."}</div>
			) : (
				levels.map((level) => (
					<MenuOption
						key={level}
						data-testid={`thinking-option-${level}`}
						onClick={() => onPick(level)}
						className="flex items-center justify-between text-card-foreground"
					>
						<span>{level}</span>
						{level === effectiveLevel && <span aria-hidden className="text-go">✓</span>}
					</MenuOption>
				))
			)}
			{footer && (
				<div className="mt-1 border-t px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>
			)}
		</>
	);
}

/** The provider-picker body: the same search and arrow-walk machine over the provider table. */
export function ProviderMenuList({
	providers,
	onPick,
}: {
	providers: { id: string; envVar: string; label: string }[];
	onPick: (provider: { id: string; envVar: string; label: string }) => void;
}) {
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	const results = providers
		.map((p) => ({ p, s: fuzzyScore(query, p.id, p.envVar, p.label) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.p.id.localeCompare(b.p.id))
		.map((r) => r.p);

	return (
		<>
			<input
				ref={searchRef}
				data-testid="provider-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null);
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (results.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, results.length - 1)
								: Math.max((i ?? results.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = results[menuIdx ?? 0];
						if (chosen) {
							e.preventDefault();
							e.stopPropagation();
							onPick(chosen);
						}
					}
				}}
				placeholder="Search providers…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{results.length === 0 && (
				<div className="px-2 py-3 text-center text-muted-foreground">No providers match.</div>
			)}
			<ul ref={listRef} data-testid="provider-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{results.map((p, i) => (
					<li key={p.id}>
						<button
							type="button"
							data-testid={`provider-option-${p.id.replace(/[^a-z0-9-]/gi, "_")}`}
							data-idx={i}
							onClick={() => onPick(p)}
							className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent hover:text-foreground ${
								i === menuIdx ? "bg-accent text-foreground ring-1 ring-inset ring-foreground/25" : ""
							}`}
						>
							<span className="truncate text-card-foreground">{p.label}</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground">{p.envVar}</span>
						</button>
					</li>
				))}
			</ul>
		</>
	);
}

/** Font row set. The DEFAULT row (null) is searchable like any family, so Enter never picks a row that is not on screen. */
export function fontMenuResults(query: string, families: string[]): Array<string | null> {
	const scored = families
		.map((f) => ({ f, s: fuzzyScore(query, f) }))
		.filter((r) => r.s !== null)
		.sort((a, b) => b.s! - a.s! || a.f.localeCompare(b.f))
		.map((r) => r.f);
	// The default row matches the factory family name and the word "default".
	const defaultScore = fuzzyScore(query, "Source Sans 3", "default");
	if (query.trim() === "" || defaultScore !== null) return [null, ...scored];
	return scored;
}

/** The custom-family row exists only when a typed query matches no family. */
export function customFamilyFor(query: string, families: string[]): string | null {
	const trimmed = query.trim();
	if (trimmed === "") return null;
	return fontMenuResults(query, families).length === 0 ? trimmed : null;
}

/** Reading-font dropdown body. One search field: when nothing matches, a "Use '<query>'" row commits the typed text as a custom family. */
export function FontMenuList({
	families,
	effectiveFamily,
	onPick,
	footer,
}: {
	/** Enumerated font families (already deduped/sorted by the caller);
	 *  undefined while the enumeration runs. */
	families: string[] | undefined;
	/** The stored override (null = the factory Source Sans 3). */
	effectiveFamily: string | null;
	/** Receives the pick: a family string, or null for the default. */
	onPick: (family: string | null) => void;
	/** Quiet footer note under the list. */
	footer?: string;
}) {
	const [query, setQuery] = useState("");
	const [menuIdx, setMenuIdx] = useState<number | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		if (menuIdx === null) return;
		listRef.current?.querySelector(`[data-idx="${menuIdx}"]`)?.scrollIntoView({ block: "nearest" });
	}, [menuIdx]);

	const results = fontMenuResults(query, families ?? []);
	// The custom-family row shows only when nothing matches. Enter picks it.
	const customFamily = customFamilyFor(query, families ?? []);
	const walkable: Array<string | null> = customFamily !== null ? ["__custom__"] : results;

	return (
		<>
			<input
				ref={searchRef}
				data-testid="font-search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setMenuIdx(null); // new query → the walk restarts on Enter/↓
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault();
						e.stopPropagation();
						if (walkable.length === 0) return;
						setMenuIdx((i) =>
							e.key === "ArrowDown"
								? Math.min((i ?? -1) + 1, walkable.length - 1)
								: Math.max((i ?? walkable.length) - 1, 0),
						);
					} else if (e.key === "Enter") {
						const chosen = walkable[menuIdx ?? 0];
						if (chosen !== undefined) {
							e.preventDefault();
							e.stopPropagation();
							onPick(chosen === "__custom__" ? customFamily : chosen);
						}
					}
				}}
				placeholder="Search fonts…"
				className="lh-input mb-1.5 w-full rounded-lg border bg-background px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
			{!families && <div className="px-2 py-3 text-center text-muted-foreground">Loading fonts…</div>}
			<ul ref={listRef} data-testid="font-list" className="flex max-h-72 flex-col overflow-y-auto px-1">
				{families &&
					results.map((family, i) => {
						const isDefault = family === null;
						const effective = isDefault ? effectiveFamily === null : family === effectiveFamily;
						return (
							<li key={family ?? "__default"}>
								<MenuOption
									data-testid={isDefault ? "font-option-default" : `font-option-${family.replace(/[^a-z0-9-]/gi, "_")}`}
									data-idx={i}
									onClick={() => onPick(family)}
									highlighted={i === menuIdx}
									className="flex w-full items-center justify-between gap-3 outline-none"
									aria-current={effective ? "true" : undefined}
								>
									<span className="truncate text-card-foreground">{family ?? "Source Sans 3"}</span>
									<span className="shrink-0 text-muted-foreground">
										{isDefault && "default"}
										{effective && <span aria-hidden className={isDefault ? "ml-1 text-go" : "text-go"}>✓</span>}
									</span>
								</MenuOption>
							</li>
						);
					})}
				{families && customFamily !== null && (
					<li>
						<MenuOption
							data-testid="font-option-custom"
							data-idx={0}
							onClick={() => onPick(customFamily)}
							highlighted={menuIdx === 0}
							className="flex w-full items-center justify-between gap-3 outline-none"
						>
							<span className="truncate text-card-foreground">Use “{customFamily}”</span>
							<span className="shrink-0 text-muted-foreground">custom</span>
						</MenuOption>
					</li>
				)}
			</ul>
			{footer && <div className="px-2 pt-1.5 text-xs text-muted-foreground">{footer}</div>}
		</>
	);
}
