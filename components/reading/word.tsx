"use client";

/**
 * A tappable word (LangHarness, 2026-10-28) — shared by the Read and
 * Watch tasks. The popover under (or above) the word shows the dictionary
 * form, the form "here", the gloss, the part of speech and whether the word
 * is new to the learner. A fresh word carries a dotted underline so the eye
 * knows where the new ground is; a word looked up keeps a faint mark.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookmarkCheckIcon, ExternalLinkIcon, PlusIcon, StarIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useActiveLanguage } from "@/components/speech";
import { useWordTranslationMode } from "@/components/settings/device-prefs";
import type { StoryToken } from "@/src/core";

interface LookupFallback {
	slug?: string;
	lemma?: string;
	gloss?: string;
	surfaceGloss?: string;
	googleTranslation?: string;
	langCode?: string;
	langTag?: string;
	langEnglish?: string;
	referenceUrl?: string;
	referenceLabel?: string;
	slovakWikiUrl?: string;
	pos?: string;
	gender?: string;
	formNote?: string;
	source?: string;
	favorite?: boolean;
	inDeck?: boolean;
}

/** One tappable word. A fresh word (not met before) carries a dotted
 *  underline so the eye knows where the new ground is; a word looked up
 *  keeps a faint mark. The popover opens above or under the word depending on viewport space. */
export function Word({ token, looked, open, onOpen, onClose }: { token: StoryToken; looked: boolean; open: boolean; onOpen: () => void; onClose: () => void }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [side, setSide] = useState<"left" | "right">("left");
	const popRef = useRef<HTMLSpanElement>(null);
	const [placeAbove, setPlaceAbove] = useState(false);
	const [isFav, setIsFav] = useState(false);
	const [inDeck, setInDeck] = useState(false);
	const [addingToBank, setAddingToBank] = useState(false);
	const [lookupData, setLookupData] = useState<LookupFallback | null>(null);
	const [loadingLookup, setLoadingLookup] = useState(false);
	const [translationMode] = useWordTranslationMode();
	const activeLang = useActiveLanguage();

	useEffect(() => {
		if (!open) return;
		const s = token.text || token.slug || token.lemma;
		if (s) {
			setLoadingLookup(true);
			const wantGt = translationMode !== "dictionary";
			void fetch(`/api/words?lookup=${encodeURIComponent(s)}${wantGt ? "&gt=1" : ""}`)
				.then((r) => r.json())
				.then((d: LookupFallback) => {
					setLookupData(d);
					if (typeof d?.favorite === "boolean") setIsFav(d.favorite);
					if (typeof d?.inDeck === "boolean") setInDeck(d.inDeck);
				})
				.catch(() => {})
				.finally(() => setLoadingLookup(false));
		}
	}, [open, token, translationMode]);

	const langCode = lookupData?.langCode ?? activeLang?.code ?? "sk";
	const langTag = lookupData?.langTag ?? activeLang?.tag ?? "sk-SK";
	const langEnglish = lookupData?.langEnglish ?? activeLang?.english ?? "Slovak";

	const resolvedSlug = token.slug ?? lookupData?.slug ?? token.lemma ?? token.text;
	const resolvedLemma = token.lemma ?? lookupData?.lemma ?? token.text;
	const dictGloss = token.gloss ?? lookupData?.gloss;
	const resolvedGloss =
		translationMode === "google"
			? lookupData?.googleTranslation ?? dictGloss
			: dictGloss ?? lookupData?.googleTranslation;
	const secondaryGoogleGloss =
		translationMode === "hybrid" &&
		lookupData?.googleTranslation &&
		dictGloss &&
		lookupData.googleTranslation.toLocaleLowerCase("en") !== dictGloss.toLocaleLowerCase("en") &&
		!dictGloss.toLocaleLowerCase("en").includes(lookupData.googleTranslation.toLocaleLowerCase("en"))
			? `Google: "${lookupData.googleTranslation}"`
			: undefined;
	const resolvedCat = token.cat ?? lookupData?.pos;
	const resolvedGender = token.gender ?? lookupData?.gender;
	const resolvedFormNote = lookupData?.formNote;

	const toggleFav = async () => {
		if (!resolvedSlug) return;
		setIsFav((prev) => !prev);
		await fetch("/api/words/favorite", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: resolvedSlug }),
		}).catch(() => {});
	};

	const handleAddToBank = async () => {
		if (!resolvedSlug || addingToBank) return;
		setAddingToBank(true);
		setInDeck(true);
		setIsFav(true);
		try {
			await fetch("/api/words", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					slug: resolvedSlug,
					word: token.text,
					gloss: resolvedGloss ?? "",
					favorite: true,
				}),
			});
		} catch {
			// ignore
		} finally {
			setAddingToBank(false);
		}
	};

	useEffect(() => {
		if (!open || !ref.current) return;
		const updatePosition = () => {
			if (!ref.current) return;
			const r = ref.current.getBoundingClientRect();
			const column = (ref.current.closest("[data-word-column]") ?? ref.current.closest("article"))?.getBoundingClientRect();
			if (column) setSide(r.left - column.left > column.width * 0.55 ? "right" : "left");
			setPlaceAbove(r.bottom > window.innerHeight - 250 && r.top > 220);
		};

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		window.visualViewport?.addEventListener("resize", updatePosition);
		window.visualViewport?.addEventListener("scroll", updatePosition);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
			window.visualViewport?.removeEventListener("resize", updatePosition);
			window.visualViewport?.removeEventListener("scroll", updatePosition);
		};
	}, [open]);

	// The card is wider than a phone's margins allow for a word near the middle
	// of the line, so it is nudged inside the screen edges with a CSS translate
	// (the open animation and the anchor word are untouched).
	useLayoutEffect(() => {
		const pop = popRef.current;
		if (!open || !pop) return;
		pop.style.translate = "";
		const anchor = ref.current?.getBoundingClientRect();
		if (!anchor) return;
		// The open animation scales the card, so its size comes from the layout box
		// and its edge from the anchor word: the card hangs off the word's left or right.
		const width = pop.offsetWidth;
		const r = { left: side === "left" ? anchor.left : anchor.right - width, right: side === "left" ? anchor.left + width : anchor.right };
		const margin = 8;
		const dx = r.right > window.innerWidth - margin ? window.innerWidth - margin - r.right : r.left < margin ? margin - r.left : 0;
		if (dx) pop.style.translate = `${dx}px`;
	}, [open, side, placeAbove]);

	const encodedWord = encodeURIComponent(token.text);
	const referenceSite = activeLang?.referenceSite;
	const referenceUrl =
		lookupData?.referenceUrl ??
		(referenceSite
			? resolvedSlug
				? `${referenceSite.baseUrl}/dictionary/${encodeURIComponent(resolvedSlug)}`
				: `${referenceSite.baseUrl}/search?q=${encodedWord}`
			: undefined);
	const referenceLabel = lookupData?.referenceLabel ?? referenceSite?.label;

	const wiktionaryUrl = `https://en.wiktionary.org/wiki/${encodedWord}#${encodeURIComponent(langEnglish)}`;
	const googleTranslateUrl = `https://translate.google.com/?sl=${encodeURIComponent(langCode)}&tl=en&text=${encodedWord}&op=translate`;
	const deeplUrl = `https://www.deepl.com/translator#${encodeURIComponent(langCode)}/en/${encodedWord}`;
	const forvoUrl = `https://forvo.com/word/${encodedWord}/#${encodeURIComponent(langCode)}`;

	return (
		<span ref={ref} className="relative inline">
			<button
				type="button"
				data-word
				onClick={() => (open ? onClose() : onOpen())}
				aria-expanded={open}
				className={cn(
					"transition-colors hover:text-teal-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-go pointer-coarse:py-2",
					token.fresh && "underline decoration-dotted decoration-xp decoration-2 underline-offset-[5px]",
					looked && !token.fresh && "underline decoration-dotted decoration-foreground/30 decoration-2 underline-offset-[5px]",
					open && "text-teal-2 underline decoration-teal decoration-2 underline-offset-[5px]",
				)}
			>
				{token.text}
			</button>
			{open && (
				<span
					ref={popRef}
					data-word-popover
					role="dialog"
					aria-label={`About ${token.text}`}
					className={cn(
						"lh-pop absolute z-30 block w-max min-w-[15rem] max-w-[22rem] rounded-lg border bg-card p-4 text-left font-prose text-base shadow-raise-hi",
						placeAbove ? "bottom-full mb-2" : "top-full mt-2",
						side === "left" ? "left-0" : "right-0",
					)}
					data-testid="word-popover"
				>
					<span className="flex items-baseline justify-between gap-3">
						<span className="font-ui text-xl font-[600] text-foreground" lang={langCode}>
							{resolvedLemma}
						</span>
						<span className="flex items-center gap-1">
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => void toggleFav()}
								aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
								title={isFav ? "Remove from favorites" : "Add to favorites"}
								className={cn("rounded-md p-1 transition-colors", isFav ? "text-teal-2 hover:bg-teal-wash" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
							>
								<StarIcon className={cn("size-4", isFav && "fill-gold")} />
							</button>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => void speak(resolvedLemma).catch(() => {})}
								aria-label="Play the word"
								className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
							>
								<Volume2Icon className="size-4" />
							</button>
						</span>
					</span>
					{(resolvedLemma.toLocaleLowerCase(langTag) !== token.text.toLocaleLowerCase(langTag) || resolvedFormNote) && (
						<span className="block font-ui text-xs text-muted-foreground">
							here: <span className="font-semibold text-foreground/80" lang={langCode}>{token.text}</span>
							{resolvedFormNote ? ` (${resolvedFormNote})` : ""}
						</span>
					)}
					<span className="mt-1 block leading-snug text-foreground">
						{resolvedGloss ? (
							<>
								<span className="block">{resolvedGloss}</span>
								{secondaryGoogleGloss && (
									<span className="mt-0.5 block font-ui text-xs text-muted-foreground">
										{secondaryGoogleGloss}
									</span>
								)}
							</>
						) : loadingLookup ? (
							<span className="inline-block h-4 w-32 animate-pulse rounded bg-accent align-middle" />
						) : (
							"Tap a dictionary link below to inspect."
						)}
					</span>
					{(resolvedCat || resolvedGender || token.fresh || lookupData?.source === "translated") && (
						<span className="mt-1.5 flex flex-wrap gap-1.5">
							{resolvedCat && <Tag>{resolvedCat.toLowerCase()}</Tag>}
							{resolvedGender && <Tag>{resolvedGender}</Tag>}
							{token.fresh && <Tag className="bg-teal-wash text-teal-2">new word</Tag>}
							{lookupData?.source === "translated" && <Tag className="bg-teal-wash text-teal-2">translated</Tag>}
						</span>
					)}
					<span className="mt-2 flex flex-wrap items-center gap-2 font-ui text-[11px] text-muted-foreground">
						{referenceUrl && referenceLabel && (
							<>
								<a
									href={referenceUrl}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-0.5 font-semibold text-foreground/90 hover:text-foreground hover:underline"
								>
									{referenceLabel} <ExternalLinkIcon className="size-2.5" />
								</a>
								<span>·</span>
							</>
						)}
						<a
							href={wiktionaryUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							Wiktionary <ExternalLinkIcon className="size-2.5" />
						</a>
						<span>·</span>
						<a
							href={deeplUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							DeepL <ExternalLinkIcon className="size-2.5" />
						</a>
						<span>·</span>
						<a
							href={forvoUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							Forvo <ExternalLinkIcon className="size-2.5" />
						</a>
					</span>
					<span className="mt-2.5 block border-t border-border/50 pt-2.5">
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => void handleAddToBank()}
							disabled={inDeck && isFav}
							data-testid="word-popover-add-bank"
							className={cn(
								"flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-ui text-xs font-[600] transition-colors",
								inDeck && isFav
									? "bg-teal-wash text-teal-2"
									: "bg-accent text-foreground hover:bg-teal-2 hover:text-primary-foreground",
							)}
						>
							{inDeck && isFav ? (
								<>
									<BookmarkCheckIcon className="size-3.5" />
									In Word Bank
								</>
							) : (
								<>
									<PlusIcon className="size-3.5" />
									Add to Word Bank
								</>
							)}
						</button>
					</span>
				</span>
			)}
		</span>
	);
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
	return <span className={cn(" rounded-md bg-accent px-2 py-0.5 font-ui text-xs font-semibold text-muted-foreground", className)}>{children}</span>;
}
