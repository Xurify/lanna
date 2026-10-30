import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { ExamPlayer } from "@/components/exam/exam-player";
import { CHAPTERS } from "@/src/core";
import { examFor } from "@/src/server";

export const dynamic = "force-dynamic";

/** The chapter exam (Skúška, phase 6a, E14): ?chapter=<id> plays that
 *  chapter's exam; without it, the list of chapters. The first draw is
 *  built with the page, so the first item is in the first HTML. */
export default async function ExamPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
	const { chapter } = await searchParams;
	const ch = CHAPTERS.find((c) => c.id === chapter);
	if (ch) {
		let draw = null;
		try {
			draw = examFor(ch.id);
		} catch {
			draw = null;
		}
		return <ExamPlayer chapterId={ch.id} title={ch.title} initial={draw} />;
	}
	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="relative flex items-center gap-2 px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16" data-testid="exam-picker">
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-black tracking-tight text-foreground">Skúška</h1>
				<p className="mt-2 max-w-2xl font-prose text-base text-muted-foreground">
					Each chapter closes with an exam drawn from its own words and forms. Every attempt is recorded on the passport; nothing is blocked by it yet.
				</p>
				<ol className="mt-8 flex flex-col gap-2">
					{CHAPTERS.map((c) => (
						<li key={c.id}>
							<Link href={`/exam?chapter=${c.id}`} className="block rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-accent">
								<span className="font-ui text-base font-bold text-foreground">{c.title}</span>
								<span className="ml-3 font-ui text-xs text-muted-foreground">{c.tagline}</span>
							</Link>
						</li>
					))}
				</ol>
			</main>
		</div>
	);
}
