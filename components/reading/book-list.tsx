"use client";

import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookState = "next" | "unread" | "read";

export interface ListBook {
	id: string;
	title: string;
	titleLang?: string;
	level: string;
	state: BookState;
	beingWritten?: boolean;
	kind: string;
	meta: string;
	actionLabel: string;
	onRead: () => void;
	onRemove?: () => void;
}

export interface ListSlot {
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	expanded?: boolean;
	testId: string;
}

export interface BookGroup {
	label: string;
	books: readonly ListBook[];
}

export function NextUp({ book }: { book: ListBook }) {
	return (
		<div className="q-card q-nextup" data-testid="read-next">
			<div className="min-w-0">
				<p className="q-nextup-kind">Next up · {book.kind}</p>
				<p className="q-nextup-title" lang={book.titleLang}>
					{book.title}
				</p>
				<p className="q-nextup-meta">{book.meta}</p>
			</div>
			<button type="button" onClick={book.onRead} className="q-btn primary shrink-0" data-testid="read-open">
				{book.actionLabel}
			</button>
		</div>
	);
}

function BookRow({ book }: { book: ListBook }) {
	const status = book.beingWritten ? "being written" : book.state === "read" ? "read" : book.state === "next" ? "next up" : "not read yet";
	return (
		<li className={cn("q-bookrow", book.state)} data-testid="read-book">
			<button type="button" className="q-bookrow-main" onClick={book.onRead} aria-label={`${book.actionLabel}: ${book.title}, ${book.kind}, ${book.meta}, ${status}`}>
				<span className="min-w-0 flex-1">
					<span className="q-bookrow-title" lang={book.titleLang}>
						{book.title}
					</span>
					<span className="q-bookrow-sub">
						{book.kind} · {book.meta}
					</span>
				</span>
				<span className="q-bookrow-end" aria-hidden="true">
					{book.beingWritten ? <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" /> : book.state === "read" ? <CheckIcon className="size-4" strokeWidth={2.2} /> : book.state === "next" ? "Next" : null}
				</span>
			</button>
			{book.onRemove && (
				<button type="button" onClick={book.onRemove} className="q-bookrow-remove" aria-label={`Remove ${book.title} from your reading`} data-testid="read-source-remove">
					<XIcon className="size-4" />
				</button>
			)}
		</li>
	);
}

export function BookList({ groups, slot, label, testId }: { groups: readonly BookGroup[]; slot?: ListSlot; label: string; testId?: string }) {
	return (
		<div className="q-books" aria-label={label} data-testid={testId}>
			{groups.map((group) => (
				<section key={group.label || "all"} className="q-books-group" aria-label={group.label || undefined}>
					{group.label && (
						<h3 className="q-books-head">
							{group.label}
							<small>
								{group.books.filter((b) => b.state === "read").length} of {group.books.length} read
							</small>
						</h3>
					)}
					<ul>
						{group.books.map((book) => (
							<BookRow key={book.id} book={book} />
						))}
					</ul>
				</section>
			))}
			{slot && (
				<button type="button" className="q-books-add" onClick={slot.onClick} aria-expanded={slot.expanded} data-testid={slot.testId}>
					{slot.icon}
					{slot.label}
				</button>
			)}
		</div>
	);
}
