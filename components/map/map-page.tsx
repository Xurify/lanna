"use client";

/**
 * /map — the Map (Quiet tool). What the lessons teach, as a learner can use it: the rules and facts of
 * the language grouped by area (sounds, pronouns, cases, verbs…), each one readable on its own with the
 * native-language bridge and what it builds on, searchable, and one press away from a practice chat on
 * exactly that rule. The force-directed graph this page used to open on is the second view, for people
 * who like to look at the web of links.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { EmptyState, KeyNote } from "@/components/quiet/empty-state";
import { Home } from "@/components/home";
import { startDraftSession } from "@/components/new-session";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { buildRulesMap, searchRules, type GraphLike, type RuleArea, type RuleItem } from "@/src/core";

type MapView = "rules" | "graph";
const VIEWS: readonly { id: MapView; label: string }[] = [
	{ id: "rules", label: "Rules" },
	{ id: "graph", label: "Graph" },
];

const full = (r: RuleItem) => `${r.statement}${r.bridge ? ` Estonian bridge: ${r.bridge}` : ""}`;

export function MapPage({ initialView = "rules", initialConfigured, rendering }: { initialView?: MapView; initialConfigured: boolean; rendering: boolean }) {
	const [view, setView] = useState<MapView>(initialView);
	const choose = (next: MapView) => {
		setView(next);
		// replaceState keeps the address shareable without a reload.
		window.history.replaceState(null, "", next === "rules" ? "/map" : "/map?view=graph");
	};
	if (view === "graph") {
		return (
			<div className="relative">
				<Home initialConfigured={initialConfigured} rendering={rendering} />
				<button type="button" onClick={() => choose("rules")} className="q-btn sec absolute left-14 top-3 z-30" data-testid="map-to-rules">
					<ArrowLeftIcon className="size-3.5" aria-hidden="true" />
					Rules
				</button>
			</div>
		);
	}
	return <RulesView onGraph={() => choose("graph")} />;
}

function RulesView({ onGraph }: { onGraph: () => void }) {
	const router = useRouter();
	const [graph, setGraph] = useState<GraphLike | null>(null);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState<Set<string>>(new Set());
	const [expanded, setExpanded] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const zeroKeys = useZeroKeys();
	const strongKeyless = useStrongKeyless();
	const keyless = zeroKeys || strongKeyless;

	const load = useCallback(() => {
		setError(false);
		fetch("/api/graph")
			.then((r) => (r.ok ? (r.json() as Promise<GraphLike>) : Promise.reject(new Error(String(r.status)))))
			.then(setGraph)
			.catch(() => setError(true));
	}, []);
	useEffect(load, [load]);

	const areas = useMemo(() => (graph ? buildRulesMap(graph) : []), [graph]);
	const results = useMemo(() => searchRules(areas, query), [areas, query]);
	const searching = query.trim().length > 0;
	const total = areas.reduce((n, a) => n + a.rules.length, 0);

	// With no search the first area starts open, so the page is never a wall of closed rows.
	const isOpen = (a: RuleArea) => searching || (open.size === 0 ? a.id === areas[0]?.id : open.has(a.id));
	const toggle = (a: RuleArea) =>
		setOpen((prev) => {
			const base = prev.size === 0 && areas[0] ? new Set([areas[0].id]) : new Set(prev);
			if (base.has(a.id)) base.delete(a.id);
			else base.add(a.id);
			return base.size === 0 ? new Set(["__none__"]) : base;
		});

	const practice = async (title: string, rules: readonly RuleItem[]) => {
		if (busy || keyless) return;
		setBusy(true);
		try {
			const picks = rules.slice(0, 12).map((r) => ({ id: r.id, name: r.name, statement: full(r) }));
			const target = await startDraftSession(`Practice: ${title}`, fetch, "practice", picks);
			if (target) router.push(target);
		} catch {
			setBusy(false);
		}
	};

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="map">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Map</h1>
				<p className="q-line dim mt-2 max-w-2xl">The rules and facts behind your lessons, by area. Open one to read it, see what it builds on, or practice it.</p>

				<div className="mt-6 flex flex-wrap items-center gap-3">
					<div className="relative min-w-56 flex-1">
						<SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search the rules, for example dative or stress"
							aria-label="Search the rules"
							data-testid="map-search"
							className="h-10 w-full rounded-lg bg-well pl-9 pr-9 text-[15px] text-foreground outline-none placeholder:text-ink-3 focus-visible:shadow-[0_0_0_1.5px_var(--q-teal)]"
						/>
						{query && (
							<button type="button" aria-label="Clear the search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-well-2">
								<XIcon className="size-3.5" />
							</button>
						)}
					</div>
					<div className="q-segc" role="tablist" aria-label="How to look at the map" data-testid="map-views">
						{VIEWS.map((v) => (
							<button key={v.id} type="button" role="tab" aria-selected={v.id === "rules"} className={cn("min-w-20", v.id === "rules" && "on")} onClick={() => v.id === "graph" && onGraph()} data-testid={`map-view-${v.id}`}>
								{v.label}
							</button>
						))}
					</div>
				</div>

				{keyless && (
					<div className="mt-3">
						<KeyNote>Practice chats need an AI key.</KeyNote>
					</div>
				)}

				<div className="mt-6 min-h-[360px]" aria-live="polite">
					{!graph && !error && (
						<div aria-busy="true" aria-label="Loading the map" className="flex flex-col gap-3" data-testid="map-loading">
							{[0, 1, 2].map((i) => (
								<div key={i} className="h-14 animate-pulse rounded-xl bg-well" />
							))}
						</div>
					)}
					{error && (
						<EmptyState testid="map-error" title="The map did not load" action={<button type="button" className="q-btn primary" onClick={load}>Try again</button>}>
							<p>Your rules are still saved. Try again in a moment.</p>
						</EmptyState>
					)}
					{graph && total === 0 && (
						<EmptyState testid="map-empty" title="Nothing on the map yet" action={<Link href="/curriculum" className="q-btn primary">Open the curriculum</Link>}>
							<p>The map fills with the rules your lessons teach. Start with a chapter in the curriculum.</p>
						</EmptyState>
					)}
					{graph && total > 0 && searching && results.length === 0 && (
						<EmptyState testid="map-no-match" title="No rule matches" action={<button type="button" className="q-btn primary" onClick={() => setQuery("")}>Clear the search</button>}>
							<p>Try the name of the rule or a word from it. Accents are optional. A longer search also reads the rule text.</p>
						</EmptyState>
					)}
					{graph && total > 0 && (
						<div className="flex flex-col gap-3">
							{results.map(({ area, hits }) => {
								const openNow = isOpen(area);
								return (
									<section key={area.id} className="q-card" data-testid={`map-area-${area.id}`}>
										<button type="button" onClick={() => !searching && toggle(area)} aria-expanded={openNow} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-well">
											<span className="min-w-0 flex-1">
												<span className="block text-[15px] font-semibold text-foreground">{area.label}</span>
												<span className="q-num block text-xs text-ink-3">
													{hits.length} {hits.length === 1 ? "rule" : "rules"}
													{searching ? ` of ${area.rules.length}` : ""}
												</span>
											</span>
											{!searching && (openNow ? <ChevronDownIcon className="size-4 text-ink-3" strokeWidth={1.6} /> : <ChevronRightIcon className="size-4 text-ink-3" strokeWidth={1.6} />)}
										</button>
										{openNow && (
											<div className="px-2 pb-3">
												<ul className="flex flex-col">
													{hits.map(({ rule }) => {
														const isExp = expanded === rule.id;
														return (
															<li key={rule.id} data-testid={`map-rule-${rule.id}`}>
																<button type="button" onClick={() => setExpanded(isExp ? null : rule.id)} aria-expanded={isExp} className="flex w-full items-start gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-well">
																	<span className="min-w-0 flex-1">
																		<span className="block text-sm font-semibold text-foreground">{rule.name}</span>
																		{!isExp && <span className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{rule.statement}</span>}
																	</span>
																	<ChevronDownIcon className={cn("mt-1 size-3.5 shrink-0 text-ink-3 transition-transform", !isExp && "-rotate-90")} strokeWidth={1.6} />
																</button>
																{isExp && (
																	<div className="px-2 pb-3">
																		<p className="max-w-[60ch] text-[14px] leading-[1.6] text-foreground">{rule.statement}</p>
																		{rule.bridge && (
																			<p className="mt-2 max-w-[60ch] text-[13px] leading-[1.55] text-ink-3">
																				<b className="font-[550] text-ink-2">Estonian:</b> {rule.bridge}
																			</p>
																		)}
																		{rule.buildsOn.length > 0 && (
																			<p className="mt-2 text-[13px] text-ink-3">
																				<b className="font-[550] text-ink-2">Builds on:</b> {rule.buildsOn.map((b) => b.name).join(" · ")}
																			</p>
																		)}
																		<div className="q-acts" style={{ marginTop: 12 }}>
																			<button type="button" className="q-btn sec" disabled={busy || keyless} onClick={() => void practice(rule.name, [rule])} data-testid={`map-practice-${rule.id}`}>
																				Practice this rule
																			</button>
																		</div>
																	</div>
																)}
															</li>
														);
													})}
												</ul>
												{!searching && (
													<div className="q-acts px-2" style={{ marginTop: 8 }}>
														<button type="button" className="q-btn ghost" disabled={busy || keyless} onClick={() => void practice(area.label, area.rules)} data-testid={`map-practice-area-${area.id}`}>
															Practice {area.label.toLowerCase()}
														</button>
													</div>
												)}
											</div>
										)}
									</section>
								);
							})}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
