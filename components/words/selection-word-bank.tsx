"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
	BookmarkCheckIcon,
	BookmarkIcon,
	CheckIcon,
	ExternalLinkIcon,
	PinIcon,
	PinOffIcon,
	StarIcon,
	Volume2Icon,
	XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fitPopoverTop, POPOVER_EDGE, POPOVER_GAP } from "@/components/words/popover-fit";
import { speak, useActiveLanguage } from "@/components/speech";
import { useWordTranslationMode, type WordTranslationMode } from "@/components/settings/device-prefs";

/**
 * Evaluates whether a DOM node is valid target-language learning content.
 * Strictly adheres to an opt-in (enabled-only) mental model:
 *
 * 1. Word/phrase selection lookup is DISABLED by default everywhere.
 * 2. It is ONLY enabled inside explicitly designated learning containers:
 *    [data-word-lookup-enabled="true"], [data-selectable-words="true"],
 *    article[data-word-lookup-enabled="true"], [data-word-column], .lh-source-passage.
 * 3. In exercises & drills (lessons, reviews, exams, fluency, listen):
 *    Lookup is strictly disabled before the learner answers ([data-word-lookup-enabled="false"])
 *    to prevent cheating / giving away hints (Clozemaster rule).
 *    Once the answer is submitted/graded, lookup becomes enabled ([data-word-lookup-enabled="true"]).
 * 4. General app chrome, dashboard widgets, headers, navigation, buttons, and
 *    English translations have no enabled container and are never eligible.
 */
export function isEligibleLearningTarget(
	node: Node | null | undefined,
	activeLangCode?: string,
): boolean {
	if (!node) return false;
	const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
	if (!el) return false;
	if (typeof el.isConnected === "boolean" && !el.isConnected) return false;

	// 1. Strictly prohibit interactive controls, inputs, navigation, sidebars, dialogs, and popovers
	if (
		el.closest(
			"input, textarea, select, [contenteditable='true'], button, [role='button'], nav, aside, [role='navigation'], [role='menu'], [role='tab'], [role='dialog'], [data-selection-bar], [data-word-popover], [data-no-word-lookup], [data-translation], [data-cue-meaning], [aria-hidden='true']",
		)
	) {
		return false;
	}

	// 2. Reject if any ancestor explicitly disables lookup (e.g. an unanswered exercise or drill)
	if (el.closest("[data-word-lookup-enabled='false'], [data-no-word-lookup='true']")) {
		return false;
	}

	// 3. Opt-in only: Must be inside an explicitly enabled learning container
	const lookupContainer = el.closest(
		"[data-word-lookup-enabled='true'], [data-selectable-words='true'], [data-learning-content='true'], article, [data-word-column], .lh-source-passage",
	);

	if (!lookupContainer) {
		return false;
	}

	// 4. Ensure we do not trigger on English translations or English UI inside the learning container
	const rootDoc = el.ownerDocument?.documentElement;
	const langEl = el.closest("[lang]");
	if (langEl && langEl !== rootDoc && lookupContainer.contains(langEl)) {
		const lang = langEl.getAttribute("lang")?.toLowerCase().trim();
		if (lang === "en" || lang === "und") return false;
		if (activeLangCode && lang && lang !== activeLangCode.toLowerCase()) return false;
	}

	return true;
}

interface SelectionInfo {
	text: string;
	x: number;
	top: number;
	bottom: number;
	placeAbove: boolean;
	isSingleWord: boolean;
}

interface LookupData {
	query?: string;
	found: boolean;
	langCode?: string;
	langTag?: string;
	langEnglish?: string;
	slug?: string;
	lemma?: string;
	gloss?: string;
	dictionaryGloss?: string;
	surfaceGloss?: string;
	googleTranslation?: string;
	referenceUrl?: string;
	referenceLabel?: string;
	slovakWikiUrl?: string;
	pos?: string;
	gender?: string;
	formNote?: string;
	source?: "lexicon" | "stem" | "grammar" | "story" | "translated";
	alternatives?: string[];
	inDeck?: boolean;
	favorite?: boolean;
}

const DOCK_STORAGE_KEY = "lh:selection-bar-docked";
const MODE_CYCLE: readonly WordTranslationMode[] = ["dictionary", "hybrid", "google"];
const MODE_BADGE_LABELS: Record<WordTranslationMode, string> = {
	dictionary: "Dict",
	hybrid: "Hybrid",
	google: "Google",
};

export function SelectionWordBankBar() {
	const pathname = usePathname();
	const [selection, setSelection] = useState<SelectionInfo | null>(null);
	const [lookup, setLookup] = useState<LookupData | null>(null);
	const [loadingLookup, setLoadingLookup] = useState(false);
	const [wordSaved, setWordSaved] = useState(false);
	const [phraseSaved, setPhraseSaved] = useState(false);
	const [docked, setDocked] = useState(false);
	const [translationMode, setTranslationMode] = useWordTranslationMode();
	const activeLang = useActiveLanguage();
	const barRef = useRef<HTMLDivElement>(null);
	const activeRangeRef = useRef<Range | null>(null);

	// Automatically dismiss popover whenever navigating or leaving a screen
	useEffect(() => {
		setSelection(null);
		setLookup(null);
		activeRangeRef.current = null;
		try {
			window.getSelection()?.removeAllRanges();
		} catch {
			// ignore
		}
	}, [pathname]);

	// Listen to browser navigation and pagehide events
	useEffect(() => {
		const handleLeave = () => {
			setSelection(null);
			setLookup(null);
			activeRangeRef.current = null;
			try {
				window.getSelection()?.removeAllRanges();
			} catch {}
		};

		window.addEventListener("popstate", handleLeave);
		window.addEventListener("pagehide", handleLeave);
		return () => {
			window.removeEventListener("popstate", handleLeave);
			window.removeEventListener("pagehide", handleLeave);
		};
	}, []);

	// Observe DOM mutations: if the selected element was unmounted or removed from document, dismiss immediately
	useEffect(() => {
		if (typeof MutationObserver === "undefined") return;
		const observer = new MutationObserver(() => {
			const range = activeRangeRef.current;
			if (range) {
				if (!range.startContainer?.isConnected || !range.endContainer?.isConnected) {
					setSelection(null);
					setLookup(null);
					activeRangeRef.current = null;
					try {
						window.getSelection()?.removeAllRanges();
					} catch {}
				}
			}
		});

		if (document.body) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		try {
			setDocked(localStorage.getItem(DOCK_STORAGE_KEY) === "1");
		} catch {
			// ignore
		}
	}, []);

	const toggleDocked = () => {
		setDocked((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(DOCK_STORAGE_KEY, next ? "1" : "0");
			} catch {
				// ignore
			}
			return next;
		});
	};

	const cycleTranslationMode = () => {
		const idx = MODE_CYCLE.indexOf(translationMode);
		const next = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length] ?? "hybrid";
		setTranslationMode(next);
	};

	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout> | null = null;
		let rafId: number | null = null;

		const computeRectCoords = (rect: DOMRect) => {
			const halfWidth = 175;
			const winWidth = window.visualViewport?.width ?? window.innerWidth;
			const clampedX = Math.max(
				halfWidth + 12,
				Math.min(winWidth - halfWidth - 12, rect.left + rect.width / 2),
			);
			const placeAbove = rect.top > 170;
			return { clampedX, placeAbove };
		};

		const checkSelection = () => {
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			const anchor = sel.anchorNode;
			const focus = sel.focusNode;
			if (!anchor || !focus) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			// LingQ / Clozemaster scoping: only allow selections in target-language learning content
			const activeCode = activeLang?.code;
			if (!isEligibleLearningTarget(anchor, activeCode) || !isEligibleLearningTarget(focus, activeCode)) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			const raw = sel.toString().trim();
			if (raw.length < 1 || raw.length > 220) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			// Must contain at least one letter
			if (!/\p{L}/u.test(raw)) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			const range = sel.getRangeAt(0);
			activeRangeRef.current = range.cloneRange();
			const rect = range.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			const cleaned = raw.replace(/^[.,!?;:"'„“”«»()[\]—–-]+|[.,!?;:"'„“”«»()[\]—–-]+$/g, "").trim();
			if (!cleaned) {
				setSelection(null);
				activeRangeRef.current = null;
				return;
			}

			const words = cleaned.split(/\s+/).filter(Boolean);
			const isSingleWord = words.length === 1;
			const { clampedX, placeAbove } = computeRectCoords(rect);

			setSelection((prev) => {
				if (prev?.text === cleaned) {
					return {
						...prev,
						x: clampedX,
						top: rect.top,
						bottom: rect.bottom,
						placeAbove,
					};
				}
				setWordSaved(false);
				setPhraseSaved(false);
				setLookup(null);
				return {
					text: cleaned,
					x: clampedX,
					top: rect.top,
					bottom: rect.bottom,
					placeAbove,
					isSingleWord,
				};
			});
		};

		const syncPositionToSelection = () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				rafId = null;
				const sel = window.getSelection();
				const range =
					sel && !sel.isCollapsed && sel.rangeCount > 0
						? sel.getRangeAt(0)
						: activeRangeRef.current;
				if (!range) return;
				if (range.startContainer && !range.startContainer.isConnected) {
					setSelection(null);
					setLookup(null);
					activeRangeRef.current = null;
					return;
				}
				const rect = range.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) return;
				const { clampedX, placeAbove } = computeRectCoords(rect);
				setSelection((prev) =>
					prev
						? {
								...prev,
								x: clampedX,
								top: rect.top,
								bottom: rect.bottom,
								placeAbove,
							}
						: null,
				);
			});
		};

		const onMouseUp = (e: MouseEvent) => {
			if (barRef.current?.contains(e.target as Node)) return;
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(checkSelection, 40);
		};

		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setSelection(null);
				setLookup(null);
				activeRangeRef.current = null;
				try {
					window.getSelection()?.removeAllRanges();
				} catch {}
				return;
			}
			if (e.shiftKey) {
				if (timeout) clearTimeout(timeout);
				timeout = setTimeout(checkSelection, 40);
			}
		};

		const onMouseDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (barRef.current?.contains(target)) return;

			// Dismiss immediately if clicking any interactive button, link, navigation, or control
			const el = target.nodeType === 1 ? (target as Element) : target.parentElement;
			if (el?.closest("button, a, [role='button'], nav, header, aside, [data-dismiss-popover]")) {
				setSelection(null);
				setLookup(null);
				activeRangeRef.current = null;
				try {
					window.getSelection()?.removeAllRanges();
				} catch {}
				return;
			}

			// Dismiss if clicking outside the active selection
			const range = activeRangeRef.current;
			if (range && range.startContainer?.isConnected) {
				try {
					const common = range.commonAncestorContainer;
					const rangeParent = common.nodeType === 1 ? (common as Element) : common.parentElement;
					if (!rangeParent?.contains(target)) {
						setSelection(null);
						setLookup(null);
						activeRangeRef.current = null;
					}
				} catch {
					setSelection(null);
					setLookup(null);
					activeRangeRef.current = null;
				}
			} else {
				setSelection(null);
				setLookup(null);
				activeRangeRef.current = null;
			}
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				setSelection(null);
				setLookup(null);
				activeRangeRef.current = null;
			}
		};

		const resizeObserver =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => syncPositionToSelection())
				: null;
		resizeObserver?.observe(document.documentElement);
		if (document.body) resizeObserver?.observe(document.body);

		document.addEventListener("mouseup", onMouseUp);
		document.addEventListener("keyup", onKeyUp);
		document.addEventListener("mousedown", onMouseDown);
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("blur", onVisibilityChange);
		window.addEventListener("scroll", syncPositionToSelection, true);
		window.addEventListener("resize", syncPositionToSelection);
		window.visualViewport?.addEventListener("resize", syncPositionToSelection);
		window.visualViewport?.addEventListener("scroll", syncPositionToSelection);
		return () => {
			if (timeout) clearTimeout(timeout);
			if (rafId !== null) cancelAnimationFrame(rafId);
			resizeObserver?.disconnect();
			document.removeEventListener("mouseup", onMouseUp);
			document.removeEventListener("keyup", onKeyUp);
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("blur", onVisibilityChange);
			window.removeEventListener("scroll", syncPositionToSelection, true);
			window.removeEventListener("resize", syncPositionToSelection);
			window.visualViewport?.removeEventListener("resize", syncPositionToSelection);
			window.visualViewport?.removeEventListener("scroll", syncPositionToSelection);
		};
	}, []);

	useEffect(() => {
		if (!selection) return;
		let cancelled = false;
		setLoadingLookup(true);
		const wantGt = translationMode !== "dictionary" || !selection.isSingleWord;
		const url = `/api/words?lookup=${encodeURIComponent(selection.text)}${wantGt ? "&gt=1" : ""}`;
		void fetch(url)
			.then((r) => r.json())
			.then((d: LookupData) => {
				if (cancelled) return;
				setLookup(d);
				if (d.inDeck && d.favorite) setWordSaved(true);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoadingLookup(false);
			});
		return () => {
			cancelled = true;
		};
	}, [selection?.text, selection?.isSingleWord, translationMode]);

	// The card's real height is only known once it is drawn, so its top is fitted
	// after layout and again whenever it resizes (the lookup arrives, a section opens):
	// above the word when it fits under the top edge, else below it, else held inside the window.
	const [fitTop, setFitTop] = useState<number | null>(null);
	const floating = !!selection && !docked;
	const selTop = selection?.top;
	const selBottom = selection?.bottom;
	useLayoutEffect(() => {
		const el = barRef.current;
		if (!floating || !el || selTop === undefined || selBottom === undefined) {
			setFitTop(null);
			return;
		}
		const fit = () => {
			const vh = window.visualViewport?.height ?? window.innerHeight;
			const top = fitPopoverTop(selTop, selBottom, el.offsetHeight, vh);
			setFitTop(Math.round(top));
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(el);
		return () => observer.disconnect();
	}, [floating, selTop, selBottom]);

	if (!selection) return null;

	const langCode = lookup?.langCode ?? activeLang?.code ?? "sk";
	const langTag = lookup?.langTag ?? activeLang?.tag ?? "sk-SK";
	const langEnglish = lookup?.langEnglish ?? activeLang?.english ?? "Slovak";

	const primaryGloss =
		translationMode === "google"
			? lookup?.googleTranslation ?? lookup?.surfaceGloss ?? lookup?.gloss
			: lookup?.gloss ?? lookup?.googleTranslation;

	const secondaryGloss =
		translationMode === "google" && lookup?.dictionaryGloss && lookup.dictionaryGloss !== primaryGloss
			? `Dict: ${lookup.dictionaryGloss}`
			: translationMode === "hybrid" &&
				  lookup?.googleTranslation &&
				  lookup.gloss &&
				  lookup.googleTranslation.toLocaleLowerCase("en") !== lookup.gloss.toLocaleLowerCase("en") &&
				  !lookup.gloss.toLocaleLowerCase("en").includes(lookup.googleTranslation.toLocaleLowerCase("en"))
				? `Google: "${lookup.googleTranslation}"`
				: undefined;

	const handleAddWord = async () => {
		if (wordSaved) return;
		setWordSaved(true);
		const target = lookup?.slug ?? selection.text;
		await fetch("/api/words", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug: target,
				word: selection.text,
				gloss: primaryGloss ?? "",
				favorite: true,
			}),
		}).catch(() => {});
	};

	const handleSavePhrase = async () => {
		if (phraseSaved) return;
		setPhraseSaved(true);
		await fetch("/api/phrases", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text: selection.text,
				translation: primaryGloss ?? "",
				source: "manual",
			}),
		}).catch(() => {});
	};

	const displayHeadword = lookup?.lemma ?? selection.text;
	const showSurfaceNote =
		lookup?.formNote ||
		(lookup?.lemma && lookup.lemma.toLocaleLowerCase(langTag) !== selection.text.toLocaleLowerCase(langTag)
			? `form of ${lookup.lemma}`
			: undefined);

	const encodedWord = encodeURIComponent(selection.text);
	const referenceSite = activeLang?.referenceSite;
	const referenceUrl =
		lookup?.referenceUrl ??
		(referenceSite
			? selection.isSingleWord && lookup?.slug
				? `${referenceSite.baseUrl}/dictionary/${encodeURIComponent(lookup.slug)}`
				: `${referenceSite.baseUrl}/search?q=${encodedWord}`
			: undefined);
	const referenceLabel = lookup?.referenceLabel ?? referenceSite?.label;

	const wiktionaryUrl = `https://en.wiktionary.org/wiki/${encodedWord}#${encodeURIComponent(langEnglish)}`;
	const googleTranslateUrl = `https://translate.google.com/?sl=${encodeURIComponent(langCode)}&tl=en&text=${encodedWord}&op=translate`;
	const deeplUrl = `https://www.deepl.com/translator#${encodeURIComponent(langCode)}/en/${encodedWord}`;
	const forvoUrl = `https://forvo.com/word/${encodedWord}/#${encodeURIComponent(langCode)}`;

	const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

	const positionStyle: React.CSSProperties = docked
		? {
				right: "20px",
				bottom: "20px",
			}
		: fitTop !== null
			? { left: `${selection.x}px`, top: `${fitTop}px`, transform: "translateX(-50%)" }
			: // First paint, before the card is measured: the old estimate, replaced before it shows.
				selection.placeAbove
				? { left: `${selection.x}px`, bottom: `${Math.max(POPOVER_EDGE, viewportHeight - selection.top + POPOVER_GAP)}px`, transform: "translateX(-50%)" }
				: { left: `${selection.x}px`, top: `${Math.max(POPOVER_EDGE, selection.bottom + POPOVER_GAP)}px`, transform: "translateX(-50%)" };

	return (
		<div
			ref={barRef}
			data-selection-bar
			data-testid="selection-word-bank-bar"
			style={positionStyle}
			className="lh-no-drag fixed z-50 w-max min-w-[18.5rem] max-w-[23.5rem] pointer-events-auto"
		>
			<div className="lh-menu-in origin-top flex flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-border bg-card/98 p-3 shadow-2xl" style={{ maxHeight: `calc(100dvh - ${POPOVER_EDGE * 2}px)` }}>
				{/* Always-visible header: headword, POS/morphology, and translation */}
				<div className="flex flex-col gap-1 border-b border-border/60 pb-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
							<span className="font-ui text-base font-semibold text-foreground break-words" lang={langCode}>
								{displayHeadword}
							</span>
							{lookup?.pos && (
								<span className="rounded-md bg-accent px-1.5 py-0.5 font-ui text-[10px] font-semibold text-muted-foreground">
									{lookup.pos.toLowerCase()}
								</span>
							)}
							{lookup?.gender && (
								<span className="rounded-md bg-accent/70 px-1.5 py-0.5 font-ui text-[10px] font-semibold text-muted-foreground">
									{lookup.gender.replace("-", " ")}
								</span>
							)}
						</div>

						<div className="flex items-center gap-0.5 shrink-0">
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={cycleTranslationMode}
								title={`Translation mode: ${translationMode} (click to switch between Dictionary, Hybrid, and Google)`}
								data-testid="selection-mode-toggle"
								className={cn(
									"rounded-md px-1.5 py-0.5 font-ui text-[10px] font-semibold transition-colors",
									translationMode === "google"
										? "bg-sky/15 text-sky"
										: translationMode === "hybrid"
											? "bg-go/15 text-go"
											: "bg-accent text-muted-foreground hover:text-foreground",
								)}
							>
								{MODE_BADGE_LABELS[translationMode]}
							</button>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={toggleDocked}
								title={docked ? "Float above selection" : "Pin to bottom-right corner (never blocks text)"}
								aria-label={docked ? "Float above selection" : "Pin to corner"}
								className={cn(
									"flex size-6 items-center justify-center rounded-lg transition-colors",
									docked
										? "bg-sky/15 text-sky"
										: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
							>
								{docked ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
							</button>
							<button
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									window.getSelection()?.removeAllRanges();
									activeRangeRef.current = null;
									setSelection(null);
								}}
								aria-label="Close selection toolbar"
								className="flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<XIcon className="size-3.5" />
							</button>
						</div>
					</div>

					{showSurfaceNote && (
						<p className="font-ui text-[11px] text-muted-foreground">
							<span className="font-semibold text-foreground/80" lang={langCode}>{selection.text}</span>
							{" — "}
							<span className="italic">{showSurfaceNote}</span>
						</p>
					)}

					{/* Translation line — never blank */}
					<div className="mt-0.5 min-h-[1.25rem]">
						{loadingLookup && !lookup ? (
							<span className="inline-block h-4 w-36 animate-pulse rounded bg-accent" />
						) : primaryGloss ? (
							<div className="flex flex-col gap-0.5">
								<p className="font-prose text-sm font-medium leading-snug text-foreground">
									{primaryGloss}
								</p>
								{secondaryGloss && (
									<p className="font-ui text-[11px] text-muted-foreground">
										{secondaryGloss}
									</p>
								)}
							</div>
						) : (
							<p className="font-ui text-xs text-muted-foreground">
								No offline gloss — use quick dictionary links below or save to bank.
							</p>
						)}
					</div>

					{/* Quick external reference links (profile-aware) */}
					<div className="mt-1 flex flex-wrap items-center gap-2 pt-0.5 font-ui text-[11px] text-muted-foreground">
						{referenceUrl && referenceLabel && (
							<>
								<a
									href={referenceUrl}
									target="_blank"
									rel="noreferrer"
									onMouseDown={(e) => e.stopPropagation()}
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
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							Wiktionary <ExternalLinkIcon className="size-2.5" />
						</a>
						<span>·</span>
						<a
							href={deeplUrl}
							target="_blank"
							rel="noreferrer"
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							DeepL <ExternalLinkIcon className="size-2.5" />
						</a>
						<span>·</span>
						<a
							href={googleTranslateUrl}
							target="_blank"
							rel="noreferrer"
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							Google <ExternalLinkIcon className="size-2.5" />
						</a>
						<span>·</span>
						<a
							href={forvoUrl}
							target="_blank"
							rel="noreferrer"
							onMouseDown={(e) => e.stopPropagation()}
							className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
						>
							Forvo <ExternalLinkIcon className="size-2.5" />
						</a>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => void speak(selection.text).catch(() => {})}
						aria-label="Listen to selection"
						title="Play pronunciation"
						className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<Volume2Icon className="size-4" />
					</button>

					{selection.isSingleWord && (
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => void handleAddWord()}
							disabled={wordSaved}
							data-testid="selection-add-word"
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-ui text-xs font-semibold transition-colors whitespace-nowrap",
								wordSaved
									? "bg-go/15 text-go"
									: "bg-go text-primary-foreground hover:brightness-105",
							)}
						>
							{wordSaved ? (
								<>
									<CheckIcon className="size-3.5" />
									In Word Bank
								</>
							) : (
								<>
									<StarIcon className="size-3.5" />
									+ Word Bank
								</>
							)}
						</button>
					)}

					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => void handleSavePhrase()}
						disabled={phraseSaved}
						data-testid="selection-save-phrase"
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-ui text-xs font-semibold transition-colors whitespace-nowrap",
							phraseSaved
								? "bg-xp/15 text-xp"
								: selection.isSingleWord
									? "bg-accent text-foreground hover:bg-accent/80"
									: "bg-go text-primary-foreground hover:brightness-105",
						)}
					>
						{phraseSaved ? (
							<>
								<BookmarkCheckIcon className="size-3.5" />
								Phrase Saved
							</>
						) : (
							<>
								<BookmarkIcon className="size-3.5" />
								Save Phrase
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
