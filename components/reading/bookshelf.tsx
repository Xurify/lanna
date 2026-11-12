"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookState = "next" | "unread" | "read";
export type BookTone = "series" | "story" | "own";

export interface ShelfBook {
	id: string;
	spineTitle: string;
	spineLabel: string;
	titleLang?: string;
	level: string;
	words: number;
	state: BookState;
	tone: BookTone;
	kind: string;
	title: string;
	meta: string;
	actionLabel: string;
	onRead: () => void;
	onRemove?: () => void;
}

export interface ShelfSlot {
	label: string;
	icon: React.ReactNode;
	level: string;
	onClick: () => void;
	testId: string;
}

const LEVEL_STEP: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };
const SPINE_HEIGHT_A1 = 228;
const SPINE_HEIGHT_PER_LEVEL = 7;
const SPINE_WIDTH_MIN = 38;
const SPINE_WIDTH_MAX = 76;
const HEADROOM_ABOVE_TALLEST = 12;
const SHELF_BOARD = 7;

export function spineSize(level: string, words: number): { width: number; height: number } {
	const width = Math.round(Math.min(SPINE_WIDTH_MAX, Math.max(SPINE_WIDTH_MIN, 30 + Math.sqrt(Math.max(0, words)) * 1.1)));
	return { width, height: SPINE_HEIGHT_A1 + (LEVEL_STEP[level] ?? 0) * SPINE_HEIGHT_PER_LEVEL };
}

export function shelfRowHeight(levels: readonly string[]): number {
	return Math.max(0, ...levels.map((level) => spineSize(level, 0).height)) + HEADROOM_ABOVE_TALLEST + SHELF_BOARD;
}

const STATE_WORDS: Record<BookState, string> = { next: "next to read", unread: "not read yet", read: "read" };
const COVER_IS_DARK: Record<BookTone, boolean> = { series: true, story: false, own: false };

export function Bookshelf({ books, slot, openId, onOpen, label, testId }: { books: readonly ShelfBook[]; slot?: ShelfSlot; openId: string | null; onOpen: (id: string | null) => void; label: string; testId?: string }) {
	const rowHeight = shelfRowHeight([...books.map((book) => book.level), ...(slot ? [slot.level] : [])]);
	return (
		<ul className="q-shelf" style={{ "--shelf-row": `${rowHeight}px` } as React.CSSProperties} aria-label={label} data-testid={testId}>
			{books.map((book) => {
				const open = book.id === openId;
				const size = spineSize(book.level, book.words);
				const coverId = `book-cover-${book.id}`;
				const next = book.state === "next";
				return (
					<li key={book.id} className={cn("q-book", book.tone, next && "next", open && "open")} style={{ "--spine-w": `${size.width}px`, "--spine-h": `${size.height}px` } as React.CSSProperties} data-testid="read-book">
						<button type="button" className="q-spine" aria-expanded={open} aria-controls={open ? coverId : undefined} aria-label={`${book.title}, ${book.spineLabel}, ${STATE_WORDS[book.state]}`} onClick={() => onOpen(open ? null : book.id)} data-testid="read-spine">
							<span className="q-spine-label" aria-hidden="true">
								{book.spineLabel}
							</span>
							<span className="q-spine-title" lang={book.titleLang} aria-hidden="true">
								{book.spineTitle}
							</span>
							{book.state === "read" && <CheckIcon className="q-spine-mark" strokeWidth={2.4} aria-hidden="true" />}
						</button>
						{open && (
							<div id={coverId} className="q-cover" role="group" aria-label={book.title} data-testid="read-cover">
								<p className="q-cover-kind">{book.kind}</p>
								<p className="q-cover-title" lang={book.titleLang}>
									{book.title}
								</p>
								<p className="q-cover-meta">{book.meta}</p>
								<div className="q-cover-acts">
									<button type="button" onClick={book.onRead} className={cn("q-btn", next || COVER_IS_DARK[book.tone] ? "sec" : "primary")} data-testid="read-open">
										{book.actionLabel}
									</button>
									{book.onRemove && (
										<button type="button" onClick={book.onRemove} className="q-cover-remove" aria-label={`Remove ${book.title} from your reading`} data-testid="read-source-remove">
											Remove
										</button>
									)}
								</div>
							</div>
						)}
					</li>
				);
			})}
			{slot && (
				<li className="q-book" style={{ "--spine-h": `${spineSize(slot.level, 0).height}px` } as React.CSSProperties}>
					<button type="button" className="q-slot" onClick={slot.onClick} data-testid={slot.testId}>
						{slot.icon}
						<span>{slot.label}</span>
					</button>
				</li>
			)}
		</ul>
	);
}
