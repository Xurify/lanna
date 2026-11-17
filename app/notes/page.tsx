import { NotesPage } from "@/components/notes/notes-page";
import { listNotes } from "@/src/server";

export const metadata = { title: "Notes" };

export const dynamic = "force-dynamic";

export default async function NotesRoute({ searchParams }: { searchParams: Promise<{ id?: string; new?: string }> }) {
	const { id, new: fresh } = await searchParams;
	const notes = listNotes();
	const version = `${notes.length}:${notes[0]?.updatedAt ?? ""}`;
	return <NotesPage key={version} initial={notes} initialId={id ?? null} fresh={fresh === "1"} />;
}
