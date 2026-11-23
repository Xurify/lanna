"use client";

import { EmptyState } from "@/components/quiet/empty-state";
import { Button } from "@/components/ui/button";
import { AddPhraseDialog, type PhraseDraft } from "@/components/words/add-phrase-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
	BookOpenIcon,
	BookmarkCheckIcon,
	CheckIcon,
	ListOrderedIcon,
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
import { CommonWords } from "@/components/words/common-words";
import { saveKnown } from "@/components/words/save-known";

const COLUMN = "mx-auto w-full max-w-4xl px-4 sm:px-6";

export type WordsTab = "words" | "common" | "phrases" | "cheatsheets";

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
	const [knownRevision, setKnownRevision] = useState(0);
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
	const [wordError, setWordError] = useState("");
	const [pendingKnown, setPendingKnown] = useState<ReadonlySet<string>>(new Set());
	const latestWordsRequest = useRef(0);
	const PAGE_SIZE = WORDS_PAGE_SIZE;

	// Saved Phrases state
	const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
	const [phraseFilter, setPhraseFilter] = useState<string>("all");
	const [phraseSearch, setPhraseSearch] = useState("");
	const [loadingPhrases, setLoadingPhrases] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);

	// Load Word Bank
	const fetchWords = useCallback(
		async (nextPage: number) => {
			const request = ++latestWordsRequest.current;
			setLoadingWords(true);
			const params = new URLSearchParams({
				offset: String(nextPage * PAGE_SIZE),
				limit: String(PAGE_SIZE),
			});
			if (searchQuery.trim()) params.set("search", searchQuery.trim());
			if (statusFilter !== "all") params.set("status", statusFilter);
			if (posFilter !== "all") params.set("pos", posFilter);

			try {
				const res = await fetch(`/api/words?${params.toString()}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = (await res.json()) as { items: WordBankItem[]; total: number; summary: WordBankSummary };
				if (request !== latestWordsRequest.current) return;
				setWords((prev) => (nextPage === 0 ? data.items : [...prev, ...data.items]));
				setPage(nextPage);
				setTotalWords(data.total);
				setSummary(data.summary);
			} catch {
				if (request === latestWordsRequest.current) setWordError("Could not load words. Try again.");
			} finally {
				if (request === latestWordsRequest.current) setLoadingWords(false);
			}
		},
		[searchQuery, statusFilter, posFilter],
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
		void fetchWords(0);
	}, [fetchWords]);

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
	const patchWord = (slug: string, patch: Partial<WordBankItem>) =>
		setWords((prev) => prev.map((w) => (w.slug === slug ? { ...w, ...patch } : w)));
	const shiftSummary = (key: "wordsFavorited" | "wordsMarkedKnown", delta: number) =>
		setSummary((current) => current && { ...current, [key]: Math.max(0, current[key] + delta) });

	const handleToggleFavorite = async (item: WordBankItem) => {
		const favorite = !item.favorite;
		setWordError("");
		patchWord(item.slug, { favorite });
		shiftSummary("wordsFavorited", favorite ? 1 : -1);
		try {
			const res = await fetch("/api/words/favorite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug: item.slug }),
			});
			if (!res.ok) throw new Error();
		} catch {
			patchWord(item.slug, { favorite: item.favorite });
			shiftSummary("wordsFavorited", favorite ? -1 : 1);
			setWordError(`Could not save ${item.lemma} as a favorite. Try again.`);
		}
	};

	const handleToggleKnown = async (item: WordBankItem) => {
		if (pendingKnown.has(item.slug)) return;
		const known = !item.known;
		setWordError("");
		setPendingKnown((current) => new Set(current).add(item.slug));
		patchWord(item.slug, { known });
		shiftSummary("wordsMarkedKnown", known ? 1 : -1);
		const saved = await saveKnown(item.slug, known);
		setPendingKnown((current) => {
			const next = new Set(current);
			next.delete(item.slug);
			return next;
		});
		if (saved) {
			setKnownRevision((v) => v + 1);
			return;
		}
		patchWord(item.slug, { known: item.known });
		shiftSummary("wordsMarkedKnown", known ? -1 : 1);
		setWordError(`Could not save ${item.lemma}. Try again.`);
	};

	const handleEnqueueReview = async (item: WordBankItem) => {
		setWordError("");
		try {
			const res = await fetch("/api/review/enqueue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slugs: [item.slug] }),
			});
			if (!res.ok) throw new Error();
			patchWord(item.slug, { inDeck: true });
		} catch {
			setWordError(`Could not add ${item.lemma} to Review. Try again.`);
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

						<WordEstimatePanel initial={initialEstimate} revision={knownRevision} />

						<div role="tablist" aria-label="Words" className="mb-6 flex overflow-x-auto border-b border-border/80">
							<WordsTabButton
								active={activeTab === "words"}
								onSelect={() => setActiveTab("words")}
								icon={<BookOpenIcon aria-hidden className="hidden size-4 sm:block" />}
								label="Words"
								count={totalWords}
							/>
							<WordsTabButton
								active={activeTab === "common"}
								onSelect={() => setActiveTab("common")}
								icon={<ListOrderedIcon aria-hidden className="hidden size-4 sm:block" />}
								label="Common words"
							/>
							<WordsTabButton
								active={activeTab === "phrases"}
								onSelect={() => setActiveTab("phrases")}
								icon={<BookmarkIcon aria-hidden className="hidden size-4 sm:block" />}
								label="Saved phrases"
								count={phrases.length}
							/>
							<WordsTabButton
								active={activeTab === "cheatsheets"}
								onSelect={() => setActiveTab("cheatsheets")}
								icon={<FileTextIcon aria-hidden className="hidden size-4 sm:block" />}
								label="Cheatsheets"
								count={sheetCount ?? undefined}
								testid="tab-cheatsheets"
							/>
						</div>
					</>
				)}

				{activeTab === "cheatsheets" && (
					<CheatsheetsTab initialSheet={initialSheet} onCount={setSheetCount} onOpenChange={setSheetOpen} />
				)}

				{activeTab === "common" && <CommonWords onKnownChange={() => setKnownRevision((v) => v + 1)} />}

				{/* ──────────────── TAB 1: WORD BANK ──────────────── */}
				{activeTab === "words" && (
					<div className="space-y-6">
						{/* Search & Filter Controls */}
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							{/* Search input */}
							<div className="relative flex-1">
								<SearchIcon
									aria-hidden
									className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
								/>
								<input
									type="search"
									aria-label="Search the dictionary"
									placeholder="Search a word or its meaning"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="q-field w-full rounded-2xl py-2.5 pl-10 pr-11 font-prose text-sm [&::-webkit-search-cancel-button]:hidden"
								/>
								{searchQuery && (
									<button
										type="button"
										aria-label="Clear the search"
										onClick={() => setSearchQuery("")}
										className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
									>
										<XIcon aria-hidden className="size-4" />
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

						<div
							role="group"
							aria-label="Show"
							className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold"
						>
							{[
								{ id: "all", label: "All", count: undefined },
								{ id: "favorite", label: "Favorites", count: summary?.wordsFavorited },
								{ id: "mastered", label: "Can recall (≥80%)", count: summary?.wordsMastered },
								{ id: "learning", label: "In progress", count: summary?.wordsLearning },
								{ id: "due", label: "Due for review", count: summary?.wordsDue },
								{ id: "new", label: "New in the deck", count: undefined },
								{ id: "known", label: "Marked known", count: summary?.wordsMarkedKnown },
							].map((tab) => (
								<button
									key={tab.id}
									type="button"
									aria-pressed={statusFilter === tab.id}
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

						{wordError && (
							<p role="alert" className="font-prose text-sm text-foreground">
								{wordError}
							</p>
						)}

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
														aria-label={`Say ${item.lemma}`}
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
																aria-label="Play the sentence"
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
											<div className="flex flex-col gap-3 sm:items-end">
												{/* Lingvist-style Memory Retention Gauge */}
												<div className="w-full sm:w-36">
													<div className="flex items-center justify-between gap-2 whitespace-nowrap font-ui text-[11px] font-semibold">
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
															{item.retention >= 80
																? "Can recall"
																: item.retention > 0
																	? "In progress"
																	: item.known
																		? "Marked known"
																		: item.inDeck
																			? "New"
																			: "Not in Review"}
														</span>
														{(item.inDeck || !item.known) && <span className="text-foreground">{item.retention}%</span>}
													</div>
													<div
														className={cn(
															"mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent",
															item.known && !item.inDeck && "invisible",
														)}
													>
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

												<div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
													<button
														type="button"
														onClick={() => void handleToggleKnown(item)}
														disabled={pendingKnown.has(item.slug)}
														aria-pressed={item.known}
														title={
															item.known ? "Counted as known. Press to undo." : "Count this word as known from now on"
														}
														data-testid="word-known"
														className={cn(
															"flex h-8 items-center gap-1.5 rounded-xl px-2.5 transition-colors pointer-coarse:h-11",
															item.known ? "bg-teal-wash text-teal-2" : "bg-well text-foreground hover:bg-well-2",
														)}
													>
														<CheckIcon aria-hidden className="size-4" />
														<span className="cap-center text-xs font-semibold">
															{item.known ? "Known" : "I know this"}
														</span>
													</button>

													{item.inDeck ? (
														<span
															title="The word is in your Review deck"
															className="flex h-8 items-center gap-1.5 px-2 text-teal-2"
														>
															<BookmarkCheckIcon aria-hidden className="size-4" />
															<span className="cap-center text-xs font-semibold">In Review</span>
														</span>
													) : (
														<button
															type="button"
															onClick={() => void handleEnqueueReview(item)}
															title="Practise this word in Review"
															className="flex h-8 items-center gap-1.5 rounded-xl px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:h-11"
														>
															<BookmarkIcon aria-hidden className="size-4" />
															<span className="cap-center text-xs font-semibold">Add to Review</span>
														</button>
													)}

													<button
														type="button"
														onClick={() => void handleToggleFavorite(item)}
														aria-pressed={item.favorite}
														aria-label={`Favorite ${item.lemma}`}
														title={item.favorite ? "Remove from favorites" : "Add to favorites"}
														className={cn(
															"grid size-8 place-items-center rounded-xl transition-colors pointer-coarse:size-11",
															item.favorite
																? "bg-gold/20 text-gold"
																: "text-muted-foreground hover:bg-accent hover:text-foreground",
														)}
													>
														<StarIcon aria-hidden className={cn("size-4", item.favorite && "fill-gold")} />
													</button>
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
										onClick={() => void fetchWords(page + 1)}
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
									aria-label="Search your saved phrases"
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
												aria-label="Play the pronunciation"
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
											aria-label={`Remove ${phrase.text}`}
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

function WordsTabButton({
	active,
	onSelect,
	icon,
	label,
	count,
	testid,
}: {
	active: boolean;
	onSelect: () => void;
	icon: React.ReactNode;
	label: string;
	count?: number;
	testid?: string;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onSelect}
			data-testid={testid}
			className={cn(
				"flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-ui text-sm font-semibold transition-colors sm:px-5",
				active
					? "text-foreground shadow-[inset_0_-2px_0_var(--q-teal)]"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{icon}
			<span className="cap-center">{label}</span>
			{count !== undefined && (
				<span className="hidden rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground tabular-nums sm:inline">
					{count}
				</span>
			)}
		</button>
	);
}
