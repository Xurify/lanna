"use client";

import { EmptyState } from "@/components/quiet/empty-state";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	BookOpenIcon,
	BookmarkCheckIcon,
	BookmarkIcon,
	CheckCheckIcon,
	CheckIcon,
	FootprintsIcon,
	PlusIcon,
	RepeatIcon,
	SearchIcon,
	StarIcon,
	Trash2Icon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/components/speech";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import type { SavedPhrase, WordBankItem, WordBankSummary } from "@/src/core";

const COLUMN = "mx-auto w-full max-w-4xl px-4 sm:px-6";

export function WordBankPage() {
	const [activeTab, setActiveTab] = useState<"words" | "phrases">("words");

	// Word Bank state
	const [words, setWords] = useState<WordBankItem[]>([]);
	const [totalWords, setTotalWords] = useState(0);
	const [summary, setSummary] = useState<WordBankSummary | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [posFilter, setPosFilter] = useState<string>("all");
	const [loadingWords, setLoadingWords] = useState(false);
	const [page, setPage] = useState(0);
	const PAGE_SIZE = 35;

	// Saved Phrases state
	const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
	const [phraseFilter, setPhraseFilter] = useState<string>("all");
	const [phraseSearch, setPhraseSearch] = useState("");
	const [loadingPhrases, setLoadingPhrases] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [newPhraseText, setNewPhraseText] = useState("");
	const [newPhraseTrans, setNewPhraseTrans] = useState("");
	const [newPhraseContext, setNewPhraseContext] = useState("");

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
	const handleAddPhrase = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newPhraseText.trim()) return;

		try {
			const res = await fetch("/api/phrases", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: newPhraseText.trim(),
					translation: newPhraseTrans.trim(),
					context: newPhraseContext.trim() || "Your own phrase",
					source: "manual",
				}),
			});
			if (res.ok) {
				const saved = (await res.json()) as SavedPhrase;
				setPhrases((prev) => [saved, ...prev]);
				setNewPhraseText("");
				setNewPhraseTrans("");
				setNewPhraseContext("");
				setShowAddModal(false);
				if (summary) {
					setSummary({ ...summary, savedPhrasesCount: summary.savedPhrasesCount + 1 });
				}
			}
		} catch (err) {
			console.error("Failed to save custom phrase", err);
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
				{/* Top Header */}
				<div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="font-title text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
							Words and phrases
						</h1>
						<p className="mt-1 font-prose text-sm text-muted-foreground sm:text-base">
							Your words, the ones you know, and your saved phrases in one place.
						</p>
					</div>

					{/* Action / Review Door */}
					<div className="flex items-center gap-2">
						{summary && summary.wordsDue > 0 && (
							<Link
								href="/review"
								className="flex items-center gap-1.5 rounded-xl bg-sky/15 px-3.5 py-2 text-xs font-semibold text-sky transition-colors hover:bg-sky/25"
							>
								<RepeatIcon className="size-4" />
								<span>{summary.wordsDue} due for review</span>
							</Link>
						)}
					</div>
				</div>

				{/* Lingvist / Speakly Style Metrics Ribbon */}
				{/* The four cards arrive with the summary; their height is held (2 rows on a phone, 1 from sm up) so the tabs and the list below never move. */}
				<div className="mb-8 min-h-[228px] sm:min-h-[108px]">
				{summary && (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Known</span>
								<CheckCheckIcon className="size-4 text-go" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsMastered}
							</p>
							<p className="text-[11px] text-muted-foreground">80% retention or better</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">In progress</span>
								<FootprintsIcon className="size-4 text-sun" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsLearning}
							</p>
							<p className="text-[11px] text-muted-foreground">Practicing</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Favorite words</span>
								<StarIcon className="size-4 fill-gold text-gold" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsFavorited}
							</p>
							<p className="text-[11px] text-muted-foreground">Marked with a star</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Saved phrases</span>
								<BookmarkIcon className="size-4 text-trail-blue" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.savedPhrasesCount}
							</p>
							<p className="text-[11px] text-muted-foreground">From stories and lessons</p>
						</div>
					</div>
				)}
				</div>

				{/* Primary Tab Selector */}
				<div className="mb-6 flex border-b border-border/80">
					<button
						type="button"
						onClick={() => setActiveTab("words")}
						className={cn(
							"flex items-center gap-2 border-b-2 px-5 py-3 font-ui text-sm font-semibold transition-colors",
							activeTab === "words"
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<BookOpenIcon className="size-4" />
						<span>Words</span>
						<span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
							{totalWords}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("phrases")}
						className={cn(
							"flex items-center gap-2 border-b-2 px-5 py-3 font-ui text-sm font-semibold transition-colors",
							activeTab === "phrases"
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<BookmarkIcon className="size-4" />
						<span>Saved phrases</span>
						<span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
							{phrases.length}
						</span>
					</button>
				</div>

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
									placeholder="Search a word or its meaning (for example chlieb, bread)"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full rounded-2xl border border-border/80 bg-accent/30 py-2.5 pl-10 pr-4 font-prose text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background"
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
								{ id: "all", label: "All" },
								{ id: "favorite", label: "Favorites" },
								{ id: "mastered", label: "Known (≥80%)" },
								{ id: "learning", label: "In progress" },
								{ id: "due", label: "Due for review" },
								{ id: "new", label: "New in the deck" },
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
								</button>
							))}
						</div>

						{/* Words List */}
						<div className="space-y-3">
							{words.map((item) => {
								return (
									<div
										key={item.slug}
										className="group rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:bg-card"
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
														{item.lemma}
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
															<p className="font-prose text-sm text-foreground">
																{item.example.sk}
															</p>
														</div>
														<p className="mt-1 pl-5.5 font-prose text-xs text-muted-foreground">
															{item.example.en}
														</p>
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
															{item.retention >= 80
																? "Known"
																: item.retention > 0
																	? "In progress"
																	: "New"}
														</span>
														<span className="text-foreground">{item.retention}%</span>
													</div>
													{/* Progress bar */}
													<div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent">
														<div
															className={cn(
																"h-full rounded-full transition-all duration-300",
																item.retention >= 80
																	? "bg-go"
																	: item.retention >= 40
																		? "bg-sun"
																		: item.retention > 0
																			? "bg-sky"
																			: "bg-transparent",
															)}
															style={{ width: `${item.retention}%` }}
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
														<StarIcon
															className={cn("size-4", item.favorite && "fill-gold")}
														/>
														<span className="text-xs font-semibold">{item.favorite ? "Favorite" : "Add to favorites"}</span>
													</button>

													{/* In review deck button */}
													{item.inDeck ? (
														<span
															title="The word is in your Review deck"
															className="flex h-8 items-center gap-1.5 px-2 text-teal-2"
														>
															<BookmarkCheckIcon className="size-4" />
															<span className="text-xs font-semibold">In Review</span>
														</span>
													) : (
														<button
															type="button"
															onClick={() => void handleEnqueueReview(item.slug)}
															title="Add to Review"
															className="flex h-8 items-center gap-1.5 rounded-xl px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
														>
															<BookmarkIcon className="size-4" />
															<span className="text-xs font-semibold">Add to Review</span>
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
									<p>Try another search or clear the filters. All your words are still here.</p>
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
										className="rounded-2xl bg-accent px-6 py-2.5 font-ui text-xs font-semibold text-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
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
									className="w-full rounded-2xl border border-border/80 bg-accent/30 py-2.5 pl-10 pr-4 font-prose text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:bg-background"
								/>
							</div>

							<button
								type="button"
								onClick={() => setShowAddModal(true)}
								className="flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 font-ui text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
							>
								<PlusIcon className="size-4" />
								<span>Add your own phrase</span>
							</button>
						</div>

						{/* Source Filters */}
						<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold">
							{[
								{ id: "all", label: "All" },
								{ id: "story", label: "From stories" },
								{ id: "speak", label: "From scenes" },
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
									className="group rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:bg-card"
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
												<p className="font-prose text-lg font-semibold leading-snug text-foreground" lang="sk" data-word-lookup-enabled="true">
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
											className="grid size-8 place-items-center rounded-xl text-muted-foreground opacity-60 transition-all hover:bg-miss/10 hover:text-miss group-hover:opacity-100"
										>
											<Trash2Icon className="size-4" />
										</button>
									</div>
								</div>
							))}

							{filteredPhrases.length === 0 && !loadingPhrases && (
								<EmptyState testid="phrases-empty" title="No saved phrases yet">
									<p>You save phrases with Save while reading stories and in lessons. It needs no AI key.</p>
								</EmptyState>
							)}
						</div>
					</div>
				)}

				{/* Add Phrase Modal Dialog */}
				{showAddModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
						<div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="font-title text-xl font-semibold text-foreground">
									Add a phrase
								</h2>
								<button
									type="button"
									onClick={() => setShowAddModal(false)}
									className="text-muted-foreground hover:text-foreground"
								>
									<XIcon className="size-5" />
								</button>
							</div>

							<form onSubmit={handleAddPhrase} className="space-y-4">
								<div>
									<label className="block font-ui text-xs font-semibold text-muted-foreground">
										Slovak phrase *
									</label>
									<input
										type="text"
										required
										autoFocus
										placeholder="for example Dnes je pekne."
										value={newPhraseText}
										onChange={(e) => setNewPhraseText(e.target.value)}
										className="mt-1 w-full rounded-xl border border-border bg-accent/40 px-3.5 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
									/>
								</div>

								<div>
									<label className="block font-ui text-xs font-semibold text-muted-foreground">
										English translation
									</label>
									<input
										type="text"
										placeholder="e.g. Today is a beautiful sunny day."
										value={newPhraseTrans}
										onChange={(e) => setNewPhraseTrans(e.target.value)}
										className="mt-1 w-full rounded-xl border border-border bg-accent/40 px-3.5 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
									/>
								</div>

								<div>
									<label className="block font-ui text-xs font-semibold text-muted-foreground">
										Context or note
									</label>
									<input
										type="text"
										placeholder="for example Weather"
										value={newPhraseContext}
										onChange={(e) => setNewPhraseContext(e.target.value)}
										className="mt-1 w-full rounded-xl border border-border bg-accent/40 px-3.5 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
									/>
								</div>

								<div className="flex items-center justify-end gap-2 pt-2">
									<button
										type="button"
										onClick={() => setShowAddModal(false)}
										className="rounded-xl px-4 py-2 font-ui text-xs font-semibold text-muted-foreground hover:text-foreground"
									>
										Cancel
									</button>
									<button
										type="submit"
										className="rounded-xl bg-primary px-5 py-2 font-ui text-xs font-semibold text-primary-foreground hover:bg-primary/90"
									>
										Save phrase
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
