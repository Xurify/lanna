"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { NoteList } from "@/components/notes/notes-page";
import type { Note } from "@/src/core";

export function NotesPanel() {
	const [notes, setNotes] = useState<Note[] | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		void fetch("/api/notes")
			.then((r) => (r.ok ? (r.json() as Promise<{ notes: Note[] }>) : Promise.reject(new Error())))
			.then((x) => setNotes(x.notes))
			.catch(() => setFailed(true));
	}, []);

	if (failed) {
		return (
			<p className="font-prose text-[15px] text-miss" role="alert">
				Your notes did not load. Reload the page to try again.
			</p>
		);
	}
	if (!notes) return <div className="min-h-40" aria-busy="true" />;

	return (
		<div className="max-w-2xl" data-testid="watch-notes">
			<div className="mb-4 flex items-center justify-between gap-3">
				<p className="font-prose text-[14px] text-ink-3">
					{notes.length === 0
						? "Write down what you hear. Paste a YouTube link into a note and stamp its moments."
						: `${notes.length} ${notes.length === 1 ? "note" : "notes"}, with links and videos or without`}
				</p>
				<Link href="/notes?new=1" className="q-btn sec t h-10 shrink-0 rounded-xl px-3.5" data-testid="notes-new">
					<PlusIcon className="size-4" strokeWidth={1.8} />
					New note
				</Link>
			</div>
			{notes.length > 0 && (
				<div className="-mx-3">
					<NoteList notes={notes} hrefFor={(id) => `/notes?id=${encodeURIComponent(id)}`} />
				</div>
			)}
		</div>
	);
}
