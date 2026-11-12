import Link from "next/link";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { METHODOLOGIES } from "@/src/core";

/**
 * /methodologies — the learning frameworks, polyglot mentors, and pedagogical
 * models behind LangHarness (2026-11-12).
 * Shows who they are, their core principles, signature techniques, and how
 * LangHarness applies their ideas in practice.
 */
export function MethodologiesPage() {
	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="methodologies">
				<div className="flex items-center justify-between">
					<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
						<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
						Today
					</Link>
					<Link href="/sources" className="text-[13px] text-ink-3 underline decoration-line-2 underline-offset-[3px] hover:text-ink-2">
						View academic sources
					</Link>
				</div>

				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">
					Methodologies
				</h1>
				<p className="q-line dim mt-2 max-w-2xl font-prose text-[15px] leading-relaxed text-ink-2">
					The language mentors, cognitive researchers, and polyglot frameworks behind LangHarness. While our Sources page documents peer-reviewed empirical studies, this page describes the practical learning methodologies we admire, their core principles, and how LangHarness applies them.
				</p>

				<nav aria-label="Methodologies" className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 font-ui text-[13px]">
					{METHODOLOGIES.map((m) => (
						<a
							key={m.id}
							href={`#${m.id}`}
							className="text-ink-3 underline decoration-line-2 underline-offset-[3px] hover:text-ink-2"
						>
							{m.name}
						</a>
					))}
				</nav>

				<div className="mt-10 flex flex-col gap-14">
					{METHODOLOGIES.map((m) => (
						<section
							key={m.id}
							id={m.id}
							className="scroll-mt-16 border-t border-[var(--q-line)] pt-8 first:border-none first:pt-0"
							data-testid="methodology-section"
							data-methodology={m.id}
						>
							<div>
								<span className="font-ui text-xs font-semibold text-ink-3">{m.origin}</span>
								<h2 className="mt-0.5 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
									{m.name}
								</h2>
								<p className="font-ui text-[14px] text-ink-3">{m.title}</p>
							</div>

							{m.quote && (
								<blockquote className="my-4 rounded-md border-l-2 border-[var(--q-line)] bg-well/40 px-3.5 py-2 font-prose text-[14px] italic text-ink-2">
									&ldquo;{m.quote}&rdquo;
								</blockquote>
							)}

							<p className="mt-3 font-prose text-[15px] leading-relaxed text-ink-2">
								{m.summary}
							</p>

							<div className="mt-6 flex flex-col gap-6">
								<div>
									<h3 className="font-ui text-xs font-semibold tracking-wide text-ink-3">
										Core principles
									</h3>
									<dl className="mt-2.5 flex flex-col gap-2.5">
										{m.keyPrinciples.map((p) => (
											<div key={p.title} className="rounded-md border border-[var(--q-line)] bg-card/40 p-3">
												<dt className="font-ui text-[13px] font-semibold text-foreground">
													{p.title}
												</dt>
												<dd className="mt-1 font-prose text-[14px] leading-relaxed text-ink-2">
													{p.detail}
												</dd>
											</div>
										))}
									</dl>
								</div>

								<div>
									<h3 className="font-ui text-xs font-semibold tracking-wide text-ink-3">
										Signature techniques
									</h3>
									<ul className="mt-2.5 flex flex-col gap-2">
										{m.signatureTechniques.map((t) => (
											<li
												key={t.name}
												className="rounded-md border border-[var(--q-line)] bg-well/30 px-3 py-2 text-[14px]"
											>
												<span className="font-ui font-semibold text-foreground">{t.name}: </span>
												<span className="font-prose text-ink-2">{t.summary}</span>
											</li>
										))}
									</ul>
								</div>

								<div className="rounded-lg border border-[var(--q-line)] bg-well/50 p-4">
									<h3 className="font-ui text-xs font-semibold text-ink-3">
										How LangHarness applies this
									</h3>
									<p className="mt-1.5 font-prose text-[14px] leading-relaxed text-ink-2">
										{m.appApplication}
									</p>
								</div>

								{m.externalLinks && m.externalLinks.length > 0 && (
									<div className="pt-1">
										<h3 className="font-ui text-xs font-semibold tracking-wide text-ink-3">
											Primary sources & verified links
										</h3>
										<ul className="mt-2 flex flex-col gap-1.5">
											{m.externalLinks.map((link) => (
												<li key={link.url}>
													<a
														href={link.url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ink-3 underline decoration-line-2 underline-offset-[3px] hover:text-ink-2"
													>
														<span>{link.label}</span>
														<ExternalLinkIcon className="size-3.5" strokeWidth={1.6} />
													</a>
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						</section>
					))}
				</div>
			</main>
		</div>
	);
}
