"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { SettingsLink } from "@/components/settings/settings-link";
import { Textarea } from "@/components/ui/textarea";
import { useActiveTime } from "@/components/use-active-time";
import { MIN_SEND_MS, WRITING_MAX_CHARS, type WritingFeedback, type WritingTarget } from "@/src/core";

export function HardWordsWriting({
	targets,
	language,
	ready,
}: {
	targets: WritingTarget[];
	language: { id: string; english: string; tag: string };
	ready: boolean;
}) {
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [reply, setReply] = useState<WritingFeedback | null>(null);
	const [error, setError] = useState("");
	const [draftSaved, setDraftSaved] = useState(true);
	const submitting = useRef(false);
	const timing = useRef(false);
	const time = useActiveTime("writing", "interactive", { start: false });
	const key = `lanna-writing:${language.id}:${targets
		.map((target) => target.slug)
		.sort()
		.join(",")}`;

	useEffect(() => {
		try {
			setText(localStorage.getItem(key) ?? "");
			setDraftSaved(true);
		} catch {
			setDraftSaved(false);
		}
		setReply(null);
	}, [key]);

	const edit = (value: string) => {
		if (!timing.current) {
			time.restart();
			timing.current = true;
		}
		setText(value);
		setReply(null);
		setError("");
		try {
			localStorage.setItem(key, value);
			setDraftSaved(true);
		} catch {
			setDraftSaved(false);
		}
	};
	const check = async () => {
		if (submitting.current || !text.trim() || !ready) return;
		submitting.current = true;
		setBusy(true);
		setError("");
		const ms = time.finish();
		timing.current = false;
		if (ms >= MIN_SEND_MS)
			void fetch("/api/progress/time", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ activity: "writing", ms, tz: new Date().getTimezoneOffset() }),
			}).catch(() => {});
		try {
			const res = await fetch("/api/writing", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ slugs: targets.map((target) => target.slug), text }),
			});
			const data = (await res.json()) as WritingFeedback & { message?: string };
			if (!res.ok) throw new Error(data.message ?? "The check could not be reached.");
			setReply(data);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "The check could not be reached.");
		} finally {
			submitting.current = false;
			setBusy(false);
		}
	};

	return (
		<div className="min-h-dvh bg-background">
			<header className="flex h-14 items-center px-3">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-5 sm:pt-12" data-testid="hardwords-writing">
				<Link href="/review" className="text-sm text-ink-3 hover:text-foreground">
					Back to Review
				</Link>
				<h1 className="mt-7 text-[32px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
					Write with these words
				</h1>
				{targets.length ? (
					<>
						<p id="writing-prompt" className="mt-3 max-w-xl font-prose text-lg leading-relaxed text-ink-2">
							Write a short scene, message, or paragraph in {language.english}. Use{" "}
							{targets.length === 1 ? "this word" : "these words"} together, in any form. Aim for two to four connected
							sentences.
						</p>
						<ul
							aria-label="Words to use"
							className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-4 text-xl font-semibold text-foreground"
						>
							{targets.map((target) => (
								<li key={target.slug} lang={language.tag}>
									{target.lemma}
								</li>
							))}
						</ul>
						<form
							className="mt-7"
							onSubmit={(event) => {
								event.preventDefault();
								void check();
							}}
						>
							<label htmlFor="writing-text" className="block text-sm font-semibold text-ink-2">
								Your writing
							</label>
							<Textarea
								id="writing-text"
								value={text}
								onChange={(event) => edit(event.target.value)}
								maxLength={WRITING_MAX_CHARS}
								disabled={busy}
								lang={language.tag}
								spellCheck={false}
								aria-describedby="writing-prompt writing-note"
								aria-invalid={!!error}
								className="mt-2 min-h-60 py-4"
								placeholder="Start with your own idea…"
								data-testid="writing-input"
							/>
							<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
								<p className="text-xs text-ink-3">
									{text.length}/{WRITING_MAX_CHARS}
								</p>
								<button
									type="submit"
									className="q-btn primary pointer-coarse:min-h-11"
									disabled={busy || !text.trim() || !ready}
									data-testid="writing-check"
								>
									{busy && <LoaderCircleIcon className="q-ico animate-spin" aria-hidden="true" />}
									<span className="cap-center">
										{busy ? "Reading your writing…" : reply ? "Check revision" : "Get feedback"}
									</span>
								</button>
							</div>
						</form>
						{!ready && (
							<p className="mt-4 text-sm text-ink-2" data-testid="writing-ai-off">
								You can write here without AI.{" "}
								<SettingsLink className="text-teal underline underline-offset-4">Set up the Cheap model</SettingsLink>{" "}
								to get feedback.
							</p>
						)}
						{error && (
							<p role="alert" className="mt-5 text-sm text-miss">
								{error}
							</p>
						)}
						<div aria-live="polite" aria-atomic="true">
							{reply && (
								<section className="mt-7 border-t border-border pt-5" data-testid="writing-feedback">
									<h2 className="text-sm font-semibold text-ink-2">AI feedback</h2>
									<p className="mt-2 whitespace-pre-wrap font-prose text-base leading-relaxed text-foreground">
										{reply.feedback}
									</p>
									<p className="mt-3 text-xs text-ink-3">
										AI can miss details. Writing here does not mark these words as learned.
									</p>
								</section>
							)}
						</div>
						<p id="writing-note" className="mt-6 text-xs leading-relaxed text-ink-3">
							{draftSaved
								? "Draft saved on this device."
								: "This browser could not save your draft. Copy it before leaving."}{" "}
							Your passage and target words are sent to your Cheap model only when you ask for feedback. Active time
							counts while you write, with idle gaps capped at 90 seconds.
						</p>
					</>
				) : (
					<p className="mt-5 text-base text-ink-2" data-testid="writing-empty">
						No words need extra practice right now. Words you miss repeatedly in Review will appear here.
					</p>
				)}
			</main>
		</div>
	);
}
