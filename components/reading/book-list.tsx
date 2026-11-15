"use client";

import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { CoverScene } from "@/components/reading/cover-scene";
import { cn } from "@/lib/utils";
import { coverMotif, coverSeed, type CoverMotif } from "@/src/core";

export type BookState = "next" | "unread" | "read";

export interface ListBook {
	id: string;
	title: string;
	titleLang?: string;
	level: string;
	state: BookState;
	beingWritten?: boolean;
	kind: string;
	length: string;
	meta: string;
	about: string;
	known?: number;
	cover?: CoverMotif;
	progress?: number;
	newWords?: readonly string[];
	actionLabel: string;
	onRead: () => void;
	onRemove?: () => void;
}

export interface ListSlot {
	label: string;
	hint: string;
	icon: React.ReactNode;
	onClick: () => void;
	expanded?: boolean;
	testId: string;
}

export interface BookGroup {
	label: string;
	name?: string;
	books: readonly ListBook[];
}

const PAPER_TONES = 5;

function Art({ book, className }: { book: ListBook; className: string }) {
	const seed = coverSeed(book.id);
	return (
		<div className={className} data-paper={seed % PAPER_TONES}>
			<CoverScene motif={book.cover ?? coverMotif(`${book.title} ${book.about}`, seed)} seed={seed} className="q-cov-scene" />
		</div>
	);
}

function Meter({ value, label }: { value: number; label: string }) {
	return (
		<span className="q-cov-meter" title={label}>
			<span style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
		</span>
	);
}

export function NextUp({ book }: { book: ListBook }) {
	return (
		<div className="q-card q-hero" data-testid="read-next">
			<Art book={book} className="q-hero-art" />
			<div className="q-hero-body">
				<p className="q-hero-kind">
					Next up <span aria-hidden="true">·</span> {book.kind}
				</p>
				<p className="q-hero-title" lang={book.titleLang}>
					{book.title}
				</p>
				<p className="q-hero-meta">{book.meta}</p>
				{book.newWords && book.newWords.length > 0 && (
					<div className="q-hero-words">
						<span className="q-hero-words-label">New words</span>
						<ul>
							{book.newWords.slice(0, 6).map((word) => (
								<li key={word} lang={book.titleLang}>
									{word}
								</li>
							))}
						</ul>
					</div>
				)}
				<button type="button" onClick={book.onRead} className="q-btn primary q-hero-go" data-testid="read-open">
					{book.actionLabel}
				</button>
			</div>
		</div>
	);
}

function Cover({ book }: { book: ListBook }) {
	const status = book.beingWritten ? "being written" : book.state === "read" ? "read" : book.state === "next" ? "next up" : "not read yet";
	return (
		<li className={cn("q-cov", book.state)} data-testid="read-book">
			<button type="button" className="q-cov-hit" onClick={book.onRead} aria-label={`${book.actionLabel}: ${book.title}, ${book.kind}, ${book.meta}, ${status}`}>
				<Art book={book} className="q-cov-art" />
				<span className="q-cov-body" aria-hidden="true">
					<span className="q-cov-kind">
						<span className="truncate">{book.kind}</span>
						<span className="q-cov-len">{book.length}</span>
					</span>
					<span className="q-cov-title" lang={book.titleLang}>
						{book.title}
					</span>
					{book.progress !== undefined ? <Meter value={book.progress} label="Parts read" /> : book.known !== undefined && book.known > 0 ? <Meter value={book.known} label="Words counted as known" /> : null}
				</span>
				{(book.state !== "unread" || book.beingWritten) && (
					<span className="q-cov-flag" aria-hidden="true">
						{book.beingWritten ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : book.state === "read" ? <CheckIcon className="size-3.5" strokeWidth={2.6} /> : null}
						{book.beingWritten ? "Writing" : book.state === "read" ? "Read" : "Next"}
					</span>
				)}
			</button>
			{book.onRemove && (
				<button type="button" onClick={book.onRemove} className="q-cov-remove" aria-label={`Remove ${book.title} from your reading`} data-testid="read-source-remove">
					<XIcon className="size-3.5" />
				</button>
			)}
		</li>
	);
}

export function BookList({ groups, slot, label, testId }: { groups: readonly BookGroup[]; slot?: ListSlot; label: string; testId?: string }) {
	const lastGroup = groups.length - 1;
	return (
		<div className="q-books" aria-label={label} data-testid={testId}>
			{groups.map((group, index) => {
				const read = group.books.filter((b) => b.state === "read").length;
				return (
					<section key={group.label || "all"} className="q-books-group" aria-label={group.label ? `${group.label} ${group.name ?? ""}`.trim() : undefined}>
						{group.label && (
							<div className="q-level">
								<span className="q-level-tag">{group.label}</span>
								<span className="q-level-name">{group.name}</span>
								<span className="q-level-count">
									{read} of {group.books.length} read
								</span>
								<span className="q-level-bar" aria-hidden="true">
									<span style={{ width: `${(read / Math.max(1, group.books.length)) * 100}%` }} />
								</span>
							</div>
						)}
						<ul className="q-covers">
							{group.books.map((book) => (
								<Cover key={book.id} book={book} />
							))}
							{slot && index === lastGroup && <SlotCover slot={slot} />}
						</ul>
					</section>
				);
			})}
			{slot && groups.length === 0 && (
				<ul className="q-covers">
					<SlotCover slot={slot} />
				</ul>
			)}
		</div>
	);
}

function SlotCover({ slot }: { slot: ListSlot }) {
	return (
		<li className="q-cov">
			<button type="button" className="q-cov-hit q-cov-slot" onClick={slot.onClick} aria-expanded={slot.expanded} data-testid={slot.testId}>
				<span className="q-cov-slot-icon">{slot.icon}</span>
				<span className="q-cov-slot-label">{slot.label}</span>
				<span className="q-cov-slot-hint">{slot.hint}</span>
			</button>
		</li>
	);
}
