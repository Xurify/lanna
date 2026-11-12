import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { SourceItem } from "@/components/sources/sources-note";
import { FEATURES, SOURCES, sourcesOf } from "@/src/core";

/**
 * /sources — the research behind every task (LangHarness, 2026-11-06).
 * For each feature: what the studies found, what they did not show and
 * which numbers are the app's own choice, then the references. A source
 * that two features lean on appears under each.
 */
export function SourcesPage() {
	const read = SOURCES.filter((s) => s.checked === "read").length;
	const linked = SOURCES.filter((s) => s.doi).length;
	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="sources">
				<div className="flex items-center justify-between">
					<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
						<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
						Today
					</Link>
					<Link href="/methodologies" className="text-[13px] text-ink-3 underline decoration-line-2 underline-offset-[3px] hover:text-ink-2">
						Learning methodologies & mentors
					</Link>
				</div>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Sources</h1>
				<p className="q-line dim mt-2 max-w-2xl">
					Each task here is built from published research, and each says so on its own page. This is the whole list: what the studies found, what they did not show, and the numbers that are our own choice.
				</p>
				<p className="q-sub max-w-2xl">
					{SOURCES.length} sources, {linked} with a link to the paper&apos;s record, {read} whose abstract was read against the claim made here. The others have a link that was checked to point at a paper with that title and first author, but were not read in full. Sources marked &ldquo;no link&rdquo; are cited from our notes and unchecked.
				</p>

				<nav aria-label="Features" className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 font-ui text-[13px]">
					{FEATURES.map((f) => (
						<a key={f.id} href={`#${f.id}`} className="text-ink-3 underline decoration-line-2 underline-offset-[3px] hover:text-ink-2">
							{f.title}
						</a>
					))}
				</nav>

				<div className="mt-8 flex flex-col gap-10">
					{FEATURES.map((f) => (
						<section key={f.id} id={f.id} className="scroll-mt-16" data-testid="sources-feature">
							<h2 className="q-sh">{f.title}</h2>
							<p className="mt-1 font-ui text-xs text-ink-3">
								<Link href={f.route} className="underline decoration-line-2 underline-offset-[3px] hover:text-ink-2">
									{f.route}
								</Link>
							</p>
							<dl className="mt-3 flex flex-col gap-3">
								<div>
									<dt className="font-ui text-xs font-semibold text-ink-3">What the research found</dt>
									<dd className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.evidence}</dd>
								</div>
								<div>
									<dt className="font-ui text-xs font-semibold text-ink-3">What it did not show</dt>
									<dd className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.limits}</dd>
								</div>
								<div>
									<dt className="font-ui text-xs font-semibold text-ink-3">The app&apos;s own choices</dt>
									<dd className="mt-1 font-prose text-[15px] leading-relaxed text-ink-2">{f.ours}</dd>
								</div>
							</dl>
							<ul className="mt-4 flex flex-col gap-2.5">
								{sourcesOf(f).map((s) => (
									<SourceItem key={s.id} source={s} />
								))}
							</ul>
						</section>
					))}
				</div>
			</main>
		</div>
	);
}
