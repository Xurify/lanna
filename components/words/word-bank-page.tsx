"use client";

import { EmptyState } from "@/components/quiet/empty-state";
import { Button } from "@/components/ui/button";
import { AddPhraseDialog, type PhraseDraft } from "@/components/words/add-phrase-dialog";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	BookOpenIcon,
	BookmarkCheckIcon,
	FileTextIcon,
	BookmarkIcon,
	PlusIcon,
	RepeatIcon,
	SearchIcon,
	StarIcon,
	Trash2Icon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useActiveLanguage } from "@/components/speech";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import type { SavedPhrase, WordBankItem, WordBankSummary, WordEstimateReport } from "@/src/core";
import { WORDS_PAGE_SIZE } from "@/components/words/page-size";
import { fillStyle } from "@/components/ui/fill";
import { CheatsheetsTab } from "@/components/words/cheatsheets";
import { WordEstimatePanel } from "@/components/words/word-estimate-panel";

const COLUMN = "mx-auto w-full max-w-4xl px-4 sm:px-6";

export type WordsTab = "words" | "phrases" | "cheatsheets";

export function WordBankPage({
	initialTab = "words",
	initialSheet,
	initialSearch,
	initialWords = null,
	initialEstimate = null,
}: {
	initialTab?: WordsTab;
	initialSheet?: string;
	initialSearch?: string;
	initialWords?: { items: WordBankItem[]; total: number; summary: WordBankSummary } | null;
	initialEstimate?: WordEstimateReport | null;
}) {
	const lang = useActiveLanguage();
	const [activeTab, setActiveTabState] = useState<WordsTab>(initialTab);
	const [sheetCount, setSheetCount] = useState<number | null>(null);
	const [sheetOpen, setSheetOpen] = useState(initialTab === "cheatsheets" && !!initialSheet);
	const setActiveTab = (tab: WordsTab) => {
		setActiveTabState(tab);
		const url = new URL(window.location.href);
		url.searchParams.delete("sheet");
		url.searchParams.delete("search");
		if (tab === "words") url.searchParams.delete("tab");
		else url.searchParams.set("tab", tab);
		window.history.replaceState(null, "", url);
	};

	// Word Bank state
	const [words, setWords] = useState<WordBankItem[]>(initialWords?.items ?? []);
	const [totalWords, setTotalWords] = useState(initialWords?.total ?? 0);
	const [summary, setSummary] = useState<WordBankSummary | null>(initialWords?.summary ?? null);
	const [searchQuery, setSearchQuery] = useState(initialSearch ?? "");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [posFilter, setPosFilter] = useState<string>("all");
	const [loadingWords, setLoadingWords] = useState(false);
	const [page, setPage] = useState(0);
	const PAGE_SIZE = WORDS_PAGE_SIZE;

	// Saved Phrases state
	const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
	const [phraseFilter, setPhraseFilter] = useState<string>("all");
	const [phraseSearch, setPhraseSearch] = useState("");
	const [loadingPhrases, setLoadingPhrases] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);

	// Load Word Bank
	const fetchWords = useCallback(
		async (reset = false) => {
			setLoadingWords(true);
			const curPage = reset ? 0 : page;
			const params = new URLSearchParams({
				offset: String(curPage * PAGE_SIZE),
				limit: String(PAGE_SIZE),
			});
			if (searchQuery.trim()) params.set("search", searchQuery.trim());
			if (statusFilter !== "all") params.set("status", statusFilter);
			if (posFilter !== "all") params.set("pos", posFilter);

			try {
				const res = await fetch(`/api/words?${params.toString()}`);
				if (res.ok) {
					const data = (await res.json()) as { items: WordBankItem[]; total: number; summary: WordBankSummary };
					if (reset) {
						setWords(data.items);
						setPage(0);
					} else {
						setWords((prev) => (curPage === 0 ? data.items : [...prev, ...data.items]));
					}
					setTotalWords(data.total);
					setSummary(data.summary);
				}
			} catch (err) {
				console.error("Failed to load words", err);
			} finally {
				setLoadingWords(false);
			}
		},
		[page, searchQuery, statusFilter, posFilter],
	);

	// Load Saved Phrases
	const fetchPhrases = useCallback(async () => {
		setLoadingPhrases(true);
		try {
			const res = await fetch("/api/phrases");
			if (res.ok) {
				const data = (await res.json()) as { phrases: SavedPhrase[] };
				setPhrases(data.phrases);
			}
		} catch (err) {
			console.error("Failed to load phrases", err);
		} finally {
			setLoadingPhrases(false);
		}
	}, []);

	// Initial load and filter effect
	useEffect(() => {
		void fetchWords(true);
	}, [searchQuery, statusFilter, posFilter]);

	useEffect(() => {
		void fetchPhrases();
	}, [fetchPhrases]);

	useEffect(() => {
		void fetch("/api/cheatsheets")
			.then((res) => (res.ok ? (res.json() as Promise<{ sheets: unknown[] }>) : null))
			.then((data) => data && setSheetCount(data.sheets.length))
			.catch(() => {});
	}, []);

	// Toggle word favorite
	const handleToggleFavorite = async (slug: string) => {
		// Optimistic UI update
		setWords((prev) =>
			prev.map((w) => {
				if (w.slug === slug) {
					return { ...w, favorite: !w.favorite };
				}
				return w;
			}),
		);
		if (summary) {
			const item = words.find((w) => w.slug === slug);
			const delta = item?.favorite ? -1 : 1;
			setSummary({ ...summary, wordsFavorited: Math.max(0, summary.wordsFavorited + delta) });
		}

		try {
			await fetch("/api/words/favorite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug }),
			});
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	// Add word to review deck
	const handleEnqueueReview = async (slug: string) => {
		try {
			await fetch("/api/review/enqueue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slugs: [slug] }),
			});
			setWords((prev) => prev.map((w) => (w.slug === slug ? { ...w, inDeck: true } : w)));
		} catch (err) {
			console.error("Failed to add to review", err);
		}
	};

	// Delete saved phrase
	const handleDeletePhrase = async (id: string) => {
		setPhrases((prev) => prev.filter((p) => p.id !== id));
		if (summary) {
			setSummary({ ...summary, savedPhrasesCount: Math.max(0, summary.savedPhrasesCount - 1) });
		}
		try {
			await fetch(`/api/phrases?id=${encodeURIComponent(id)}`, { method: "DELETE" });
		} catch (err) {
			console.error("Failed to delete phrase", err);
		}
	};

	// Create custom phrase
	const savePhrase = async (draft: PhraseDraft): Promise<boolean> => {
		try {
			const res = await fetch("/api/phrases", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: draft.text.trim(),
					translation: draft.translation.trim(),
					context: draft.context.trim() || "Your own phrase",
					source: "manual",
				}),
			});
			if (!res.ok) return false;
			const saved = (await res.json()) as SavedPhrase;
			setPhrases((prev) => [saved, ...prev]);
			setShowAddModal(false);
			if (summary) setSummary({ ...summary, savedPhrasesCount: summary.savedPhrasesCount + 1 });
			return true;
		} catch {
			return false;
		}
	};

	// Filtered phrases
	const filteredPhrases = phrases.filter((p) => {
		if (phraseFilter !== "all" && p.source !== phraseFilter) return false;
		if (phraseSearch.trim()) {
			const q = phraseSearch.toLowerCase();
			return p.text.toLowerCase().includes(q) || p.translation.toLowerCase().includes(q);
		}
		return true;
	});

	return (
		<div className="min-h-dvh bg-background pb-28 pt-8">
			<div className={COLUMN}>
				{!sheetOpen && (
					<>
						<div className="mb-5 flex min-h-11 items-center justify-between gap-3">
							<h1 className="font-title text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Words</h1>
							{summary && summary.wordsDue > 0 && (
								<Link href="/review" className="q-btn sec pointer-coarse:min-h-11">
									<RepeatIcon className="size-4" />
									{summary.wordsDue} due for review
								</Link>
							)}
						</div>

						<WordEstimatePanel initial={initialEstimate} />

						{/* Primary Tab Selector */}
						<div className="mb-6 flex overflow-x-auto border-b border-border/80">
							<button
								type="button"
								onClick={() => setActiveTab("words")}
								className={cn(
									"flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-ui text-sm font-semibold transition-colors sm:px-5",
									activeTab === "words"
										? "text-foreground shadow-[inset_0_-2px_0_var(--q-teal)]"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<BookOpenIcon className="hidden size-4 sm:block" />
								<span className="cap-center">Words</span>
								<span className="hidden rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground sm:inline">
									{totalWords}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("phrases")}
								className={cn(
									"flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-ui text-sm font-semibold transition-colors sm:px-5",
									activeTab === "phrases"
										? "text-foreground shadow-[inset_0_-2px_0_var(--q-teal)]"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<BookmarkIcon className="hidden size-4 sm:block" />
								<span className="cap-center">Saved phrases</span>
								<span className="hidden rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground sm:inline">
									{phrases.length}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("cheatsheets")}
								data-testid="tab-cheatsheets"
								className={cn(
									"flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-ui text-sm font-semibold transition-colors sm:px-5",
									activeTab === "cheatsheets"
										? "text-foreground shadow-[inset_0_-2px_0_var(--q-teal)]"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<FileTextIcon className="hidden size-4 sm:block" />
								<span className="cap-center">Cheatsheets</span>
								{sheetCount !== null && (
									<span className="hidden rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground sm:inline">
										{sheetCount}
									</span>
								)}
							</button>
						</div>
					</>
				)}

				{activeTab === "cheatsheets" && (
					<CheatsheetsTab initialSheet={initialSheet} onCount={setSheetCount} onOpenChange={setSheetOpen} />
				)}

				{/* ──────────────── TAB 1: WORD BANK ──────────────── */}
				{activeTab === "words" && (
					<div className="space-y-6">
						{/* Search & Filter Controls */}
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							{/* Search input */}
							<div className="relative flex-1">
								<SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Search a word or its meaning"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="q-field w-full rounded-2xl py-2.5 pl-10 pr-4 font-prose text-sm"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										<XIcon className="size-4" />
									</button>
								)}
							</div>

							{/* Part of Speech Dropdown */}
							<ChoiceMenu
								value={posFilter}
								onChange={setPosFilter}
								ariaLabel="Filter by part of speech"
								className="w-56 shrink-0"
								options={[
									{ value: "all", label: "All parts of speech" },
									{ value: "noun", label: "Nouns" },
									{ value: "verb", label: "Verbs" },
									{ value: "adj", label: "Adjectives" },
									{ value: "adv", label: "Adverbs" },
									{ value: "phrase", label: "Phrases" },
								]}
							/>
						</div>

						{/* Status Filters Bar */}
						<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold">
							{[
								{ id: "all", label: "All", count: undefined },
								{ id: "favorite", label: "Favorites", count: summary?.wordsFavorited },
								{ id: "mastered", label: "Can recall (≥80%)", count: summary?.wordsMastered },
								{ id: "learning", label: "In progress", count: summary?.wordsLearning },
								{ id: "due", label: "Due for review", count: summary?.wordsDue },
								{ id: "new", label: "New in the deck", count: undefined },
							].map((tab) => (
								<button
									key={tab.id}
									type="button"
									onClick={() => setStatusFilter(tab.id)}
									className={cn(
										"rounded-xl px-3 py-1.5 transition-colors",
										statusFilter === tab.id
											? "bg-primary text-primary-foreground shadow-sm"
											: "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
								>
									{tab.label}
									{tab.count !== undefined && (
										<span className="ml-1.5 font-normal tabular-nums opacity-80">{tab.count}</span>
									)}
								</button>
							))}
						</div>

						{/* Words List */}
						<div className="space-y-3">
							{words.map((item) => {
								return (
									<div
										key={item.slug}
										className="group rounded-2xl border border-border/80 bg-card p-4 transition-colors hover:border-border hover:bg-card"
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											{/* Word Left side */}
											<div className="flex-1">
												<div className="flex flex-wrap items-center gap-2">
													{/* Audio button */}
													<button
														type="button"
														onClick={() => void speak(item.lemma).catch(() => {})}
														title="Say the word"
														className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/80 text-foreground transition-transform hover:scale-105 active:scale-95"
													>
														<Volume2Icon className="size-4" />
													</button>

													<span className="font-prose text-xl font-semibold text-foreground">
														{item.match?.span ? (
															<>
																{item.lemma.slice(0, item.match.span[0])}
																<mark className="bg-transparent font-bold text-teal-2 underline decoration-teal decoration-2 underline-offset-4">
																	{item.lemma.slice(item.match.span[0], item.match.span[1])}
																</mark>
																{item.lemma.slice(item.match.span[1])}
															</>
														) : (
															item.lemma
														)}
													</span>

													{/* Badges */}
													{item.pos && (
														<span className="rounded-lg bg-accent px-2 py-0.5 font-ui text-[11px] font-semibold text-muted-foreground">
															{item.pos}
														</span>
													)}

													{item.gender && (
														<span className="rounded-lg bg-accent/60 px-1.5 py-0.5 font-ui text-[11px] text-muted-foreground">
															{item.gender.replace("-", " ")}
														</span>
													)}

													{item.rank && item.rank <= 1000 && (
														<span className="rounded-lg bg-gold/15 px-2 py-0.5 font-ui text-[11px] font-semibold text-gold">
															#{item.rank}
														</span>
													)}
												</div>

												{/* English Gloss */}
												<p className="mt-1.5 pl-10 font-prose text-sm font-medium text-muted-foreground">
													{item.gloss}
												</p>
												{item.match?.via && (
													<p className="mt-0.5 pl-10 font-ui text-xs text-ink-3" data-testid="word-match-kind">
														{item.match.kind === "meaning"
															? `Matches meaning: ${item.match.via}`
															: item.match.kind === "form"
																? `Matches the form: ${item.match.via}`
																: `Matches an example: ${item.match.via}`}
													</p>
												)}

												{/* Example Sentence */}
												{item.example && (
													<div className="mt-3 rounded-xl border border-border/40 bg-accent/25 p-3 pl-3.5 sm:ml-10">
														<div className="flex items-center gap-2">
															<button
																type="button"
																onClick={() => void speak(item.example!.sk).catch(() => {})}
																className="text-muted-foreground hover:text-foreground"
																title="Play the sentence"
															>
																<Volume2Icon className="size-3.5" />
															</button>
															<p className="cap-center font-prose text-sm text-foreground">{item.example.sk}</p>
														</div>
														<p className="mt-1 pl-5.5 font-prose text-xs text-muted-foreground">{item.example.en}</p>
													</div>
												)}
											</div>

											{/* Right side: Retention Gauge & Actions */}
											<div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
												{/* Lingvist-style Memory Retention Gauge */}
												<div className="w-28 text-right sm:w-32">
													<div className="flex items-center justify-between font-ui text-[11px] font-semibold">
														<span
															className={cn(
																item.retention >= 80
																	? "text-go"
																	: item.retention >= 40
																		? "text-sun"
																		: item.retention > 0
																			? "text-sky"
																			: "text-muted-foreground",
															)}
														>
															{item.retention >= 80 ? "Can recall" : item.retention > 0 ? "In progress" : "New"}
														</span>
														<span className="text-foreground">{item.retention}%</span>
													</div>
													{/* Progress bar */}
													<div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent">
														<div
															className={cn(
																"lanna-fill rounded-full",
																item.retention >= 80
																	? "bg-go"
																	: item.retention >= 40
																		? "bg-sun"
																		: item.retention > 0
																			? "bg-sky"
																			: "bg-transparent",
															)}
															style={fillStyle(item.retention / 100)}
														/>
													</div>
												</div>

												{/* Action Buttons */}
												<div className="flex items-center gap-1.5">
													{/* Favorite button */}
													<button
														type="button"
														onClick={() => void handleToggleFavorite(item.slug)}
														title={item.favorite ? "Remove from favorites" : "Add to favorites"}
														className={cn(
															"flex h-8 items-center gap-1.5 rounded-xl px-2 transition-colors",
															item.favorite
																? "bg-gold/20 text-gold"
																: "text-muted-foreground hover:bg-accent hover:text-foreground",
														)}
													>
														<StarIcon className={cn("size-4", item.favorite && "fill-gold")} />
														<span className="cap-center text-xs font-semibold">
															{item.favorite ? "Favorite" : "Add to favorites"}
														</span>
													</button>

													{/* In review deck button */}
													{item.inDeck ? (
														<span
															title="The word is in your Review deck"
															className="flex h-8 items-center gap-1.5 px-2 text-teal-2"
														>
															<BookmarkCheckIcon className="size-4" />
															<span className="cap-center text-xs font-semibold">In Review</span>
														</span>
													) : (
														<button
															type="button"
															onClick={() => void handleEnqueueReview(item.slug)}
															title="Add to Review"
															className="flex h-8 items-center gap-1.5 rounded-xl px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
														>
															<BookmarkIcon className="size-4" />
															<span className="cap-center text-xs font-semibold">Add to Review</span>
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}

							{words.length === 0 && !loadingWords && (
								<EmptyState
									testid="words-empty"
									title="No words match"
									action={
										<button
											type="button"
											className="q-btn primary"
											onClick={() => {
												setSearchQuery("");
												setStatusFilter("all");
												setPosFilter("all");
											}}
										>
											Clear the filters
										</button>
									}
								>
									<p>
										{searchQuery.trim()
											? "Search by how a word starts, or by its English meaning. Accents are optional. A longer search also looks in example sentences, and a few words in a row find the sentence that has them."
											: "Try another filter. All your words are still here."}
									</p>
								</EmptyState>
							)}

							{/* Load More Button */}
							{words.length < totalWords && (
								<div className="pt-4 text-center">
									<button
										type="button"
										onClick={() => {
											setPage((p) => p + 1);
											void fetchWords(false);
										}}
										disabled={loadingWords}
										className="rounded-2xl bg-accent px-6 py-2.5 font-ui text-xs font-semibold text-foreground transition-colors hover:bg-well-2 disabled:opacity-50"
									>
										{loadingWords ? "Loading…" : "Show more words"}
									</button>
								</div>
							)}
						</div>
					</div>
				)}

				{/* ──────────────── TAB 2: SAVED PHRASES ──────────────── */}
				{activeTab === "phrases" && (
					<div className="space-y-6">
						{/* Phrases Filter and Add Phrase Button */}
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="relative flex-1">
								<SearchIcon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Search your saved phrases"
									value={phraseSearch}
									onChange={(e) => setPhraseSearch(e.target.value)}
									className="q-field w-full rounded-2xl py-2.5 pl-10 pr-4 font-prose text-sm"
								/>
							</div>

							<Button type="button" onClick={() => setShowAddModal(true)}>
								<PlusIcon aria-hidden />
								Add your own phrase
							</Button>
						</div>

						{/* Source Filters */}
						<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold">
							{[
								{ id: "all", label: "All" },
								{ id: "story", label: "From stories" },
								{ id: "speak", label: "From scenes" },
								{ id: "review", label: "From review" },
								{ id: "lesson", label: "From lessons" },
								{ id: "manual", label: "Your own phrases" },
							].map((tab) => (
								<button
									key={tab.id}
									type="button"
									onClick={() => setPhraseFilter(tab.id)}
									className={cn(
										"rounded-xl px-3 py-1.5 transition-colors",
										phraseFilter === tab.id
											? "bg-primary text-primary-foreground shadow-sm"
											: "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
								>
									{tab.label}
								</button>
							))}
						</div>

						{/* Phrases Cards List */}
						<div className="space-y-3">
							{filteredPhrases.map((phrase) => (
								<div
									key={phrase.id}
									className="group rounded-2xl border border-border/80 bg-card p-4 transition-colors hover:border-border hover:bg-card"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-start gap-3">
											<button
												type="button"
												onClick={() => void speak(phrase.text).catch(() => {})}
												title="Play the pronunciation"
												className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent/80 text-foreground transition-transform hover:scale-105 active:scale-95"
											>
												<Volume2Icon className="size-4" />
											</button>
											<div>
												<p
													className="font-prose text-lg font-semibold leading-snug text-foreground"
													lang={lang?.code}
													data-word-lookup-enabled="true"
												>
													{phrase.text}
												</p>
												<p className="mt-1 font-prose text-sm text-muted-foreground" lang="en">
													{phrase.translation}
												</p>
												{phrase.context && (
													<span className="mt-2 inline-block rounded-md bg-accent/60 px-2 py-0.5 font-ui text-[11px] font-semibold text-muted-foreground">
														{phrase.context}
													</span>
												)}
											</div>
										</div>

										<button
											type="button"
											onClick={() => void handleDeletePhrase(phrase.id)}
											title="Remove the phrase"
											className="grid size-8 place-items-center rounded-xl text-muted-foreground opacity-60 transition-[color,background-color,opacity] hover:bg-miss/10 hover:text-miss group-hover:opacity-100"
										>
											<Trash2Icon className="size-4" />
										</button>
									</div>
								</div>
							))}

							{filteredPhrases.length === 0 && !loadingPhrases && (
								<EmptyState testid="phrases-empty" title="No saved phrases yet">
									<p>
										Press Save on a phrase in a story, a scene, a lesson or a review card to keep it here, or add your
										own. No AI key needed.
									</p>
								</EmptyState>
							)}
						</div>
					</div>
				)}

				{showAddModal && <AddPhraseDialog onClose={() => setShowAddModal(false)} onSave={savePhrase} />}
			</div>
		</div>
	);
}
