"use client";

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
					context: newPhraseContext.trim() || "Vlastná fráza (Custom)",
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
							Slovník a frázy
						</h1>
						<p className="mt-1 font-prose text-sm text-muted-foreground sm:text-base">
							Váš osobný slovník, zvládnuté slová a uložené frázy na jednom mieste.
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
								<span>{summary.wordsDue} na opakovanie</span>
							</Link>
						)}
					</div>
				</div>

				{/* Lingvist / Speakly Style Metrics Ribbon */}
				{summary && (
					<div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Zvládnuté</span>
								<CheckCheckIcon className="size-4 text-go" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsMastered}
							</p>
							<p className="text-[11px] text-muted-foreground">Retencia ≥ 80%</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">V procese</span>
								<FootprintsIcon className="size-4 text-sun" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsLearning}
							</p>
							<p className="text-[11px] text-muted-foreground">V precvičovaní</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Obľúbené slová</span>
								<StarIcon className="size-4 fill-gold text-gold" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.wordsFavorited}
							</p>
							<p className="text-[11px] text-muted-foreground">Označené hviezdičkou</p>
						</div>

						<div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="font-ui text-xs font-semibold">Uložené frázy</span>
								<BookmarkIcon className="size-4 text-trail-blue" />
							</div>
							<p className="mt-2 font-ui text-2xl font-semibold text-foreground">
								{summary.savedPhrasesCount}
							</p>
							<p className="text-[11px] text-muted-foreground">Z príbehov a lekcií</p>
						</div>
					</div>
				)}

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
						<span>Slovník (Word Bank)</span>
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
						<span>Uložené frázy (Saved Phrases)</span>
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
									placeholder="Hľadať slovo alebo význam (napr. chlieb, bread)..."
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
								ariaLabel="Filter podľa slovného druhu"
								className="w-56 shrink-0"
								options={[
									{ value: "all", label: "Všetky slovné druhy" },
									{ value: "noun", label: "Podstatné mená (Nouns)" },
									{ value: "verb", label: "Slovesá (Verbs)" },
									{ value: "adj", label: "Prídavné mená (Adjectives)" },
									{ value: "adv", label: "Príslovky (Adverbs)" },
									{ value: "phrase", label: "Frázy (Phrases)" },
								]}
							/>
						</div>

						{/* Status Filters Bar */}
						<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold">
							{[
								{ id: "all", label: "Všetky" },
								{ id: "favorite", label: "★ Obľúbené" },
								{ id: "mastered", label: "Zvládnuté (≥80%)" },
								{ id: "learning", label: "V procese" },
								{ id: "due", label: "Na opakovanie" },
								{ id: "new", label: "Nové v balíčku" },
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
										className="group rounded-2xl border border-border/80 bg-card/50 p-4 transition-all hover:border-border hover:bg-card/90"
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											{/* Word Left side */}
											<div className="flex-1">
												<div className="flex flex-wrap items-center gap-2">
													{/* Audio button */}
													<button
														type="button"
														onClick={() => void speak(item.lemma).catch(() => {})}
														title="Vysloviť slovo"
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
																title="Prehrať vetu"
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
																? "Zvládnuté"
																: item.retention > 0
																	? "V procese"
																	: "Nové"}
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
														title={item.favorite ? "Odstrániť z obľúbených" : "Pridať k obľúbeným"}
														className={cn(
															"grid size-8 place-items-center rounded-xl transition-colors",
															item.favorite
																? "bg-gold/20 text-gold"
																: "text-muted-foreground hover:bg-accent hover:text-foreground",
														)}
													>
														<StarIcon
															className={cn("size-4", item.favorite && "fill-gold")}
														/>
													</button>

													{/* In review deck button */}
													{item.inDeck ? (
														<span
															title="Slovo je v precvičovacom balíčku"
															className="grid size-8 place-items-center text-sky"
														>
															<BookmarkCheckIcon className="size-4" />
														</span>
													) : (
														<button
															type="button"
															onClick={() => void handleEnqueueReview(item.slug)}
															title="Pridať do opakovania (Review deck)"
															className="grid size-8 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
														>
															<BookmarkIcon className="size-4" />
														</button>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}

							{words.length === 0 && !loadingWords && (
								<div className="rounded-2xl border border-dashed border-border/80 p-12 text-center text-muted-foreground">
									<BookOpenIcon className="mx-auto mb-3 size-8 opacity-40" />
									<p className="font-ui text-sm font-semibold">Žiadne slová nevyhovujú filtru.</p>
								</div>
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
										{loadingWords ? "Načítavam..." : "Načítať ďalšie slová"}
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
									placeholder="Hľadať v uložených frázach..."
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
								<span>Pridať vlastnú frázu</span>
							</button>
						</div>

						{/* Source Filters */}
						<div className="flex flex-wrap items-center gap-1.5 font-ui text-xs font-semibold">
							{[
								{ id: "all", label: "Všetky" },
								{ id: "story", label: "Z príbehov (Stories)" },
								{ id: "speak", label: "Z dialógov (Scenes)" },
								{ id: "lesson", label: "Z lekcií (Lessons)" },
								{ id: "manual", label: "Vlastné frázy" },
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
									className="group rounded-2xl border border-border/80 bg-card/50 p-4 transition-all hover:border-border hover:bg-card/90"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="flex items-start gap-3">
											<button
												type="button"
												onClick={() => void speak(phrase.text).catch(() => {})}
												title="Prehrať výslovnosť"
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
											title="Odstrániť frázu"
											className="grid size-8 place-items-center rounded-xl text-muted-foreground opacity-60 transition-all hover:bg-miss/10 hover:text-miss group-hover:opacity-100"
										>
											<Trash2Icon className="size-4" />
										</button>
									</div>
								</div>
							))}

							{filteredPhrases.length === 0 && !loadingPhrases && (
								<div className="rounded-2xl border border-dashed border-border/80 p-12 text-center text-muted-foreground">
									<BookmarkIcon className="mx-auto mb-3 size-8 opacity-40" />
									<p className="font-ui text-sm font-semibold">Žiadne uložené frázy.</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Add Phrase Modal Dialog */}
				{showAddModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
						<div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="font-title text-xl font-semibold text-foreground">
									Pridať novú frázu
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
										Slovenská fráza *
									</label>
									<input
										type="text"
										required
										autoFocus
										placeholder="napr. Dnes je krásny slnečný deň."
										value={newPhraseText}
										onChange={(e) => setNewPhraseText(e.target.value)}
										className="mt-1 w-full rounded-xl border border-border bg-accent/40 px-3.5 py-2 font-prose text-sm text-foreground outline-none focus:border-primary"
									/>
								</div>

								<div>
									<label className="block font-ui text-xs font-semibold text-muted-foreground">
										Anglický preklad
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
										Kontext / Poznámka
									</label>
									<input
										type="text"
										placeholder="napr. Počasie / Dovolenka"
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
										Zrušiť
									</button>
									<button
										type="submit"
										className="rounded-xl bg-primary px-5 py-2 font-ui text-xs font-semibold text-primary-foreground hover:bg-primary/90"
									>
										Uložiť frázu
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
