"use client";

/**
 * The jump palette (Quiet tool), opened with Ctrl or Cmd K. It lists every place in the app, the
 * curriculum's units once the progress summary has loaded, and the Slovak letters a keyboard may lack.
 * There is no search bar on any screen; the keys for those letters sit inside the exercises that need
 * them (components/diacritic-bar.tsx).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QIcon } from "@/components/quiet/icon";
import { insertAtCaret } from "@/components/diacritic-bar";
import { useSidebar } from "@/components/sidebar";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { fuzzyScore } from "@/src/core";
import { cn } from "@/lib/utils";

interface JumpApi {
	open: (letters?: boolean) => void;
}

const JumpContext = createContext<JumpApi>({ open: () => {} });

export function useJump() {
	return useContext(JumpContext);
}

interface Place {
	id: string;
	title: string;
	hint: string;
	icon: React.ReactNode;
	run: (go: (href: string) => void) => void;
	/** Extra words the query may match. */
	words?: string;
}

const SLOVAK_LETTERS = ["á", "ä", "č", "ď", "é", "í", "ĺ", "ľ", "ň", "ó", "ô", "ŕ", "š", "ť", "ú", "ý", "ž"];

const ROUTES: Array<{ title: string; hint: string; href: string; icon: React.ComponentProps<typeof QIcon>["name"]; words?: string }> = [
	{ title: "Today", hint: "The plan for today", href: "/", icon: "flag" },
	{ title: "Review", hint: "Your word deck", href: "/review", icon: "review", words: "cards deck spaced" },
	{ title: "Listen", hint: "Ten sentences you can follow", href: "/listen", icon: "listen", words: "hear audio" },
	{ title: "Read", hint: "Stories, every word tappable", href: "/read", icon: "read", words: "stories episode library" },
	{ title: "Watch", hint: "A video with both subtitles", href: "/watch", icon: "play", words: "youtube video" },
	{ title: "Speak", hint: "A scene said out loud", href: "/speak", icon: "speak", words: "scene talk voice" },
	{ title: "Talk in writing", hint: "A role-play in writing", href: "/speak?mode=typed", icon: "tutor", words: "chat typed" },
	{ title: "Speed", hint: "Known sentences, said faster", href: "/speed?mode=fast", icon: "fast", words: "say it faster speed" },
	{ title: "Blitz", hint: "60 seconds: answer as many as you can", href: "/lesson?mode=blitz", icon: "fast", words: "speed" },
	{ title: "Words", hint: "Everything you have met", href: "/words", icon: "words", words: "vocabulary lexicon" },
	{ title: "Grammar", hint: "Cases, genders, and your score on each", href: "/grammar", icon: "grammar", words: "atlas cases" },
	{ title: "Mistakes", hint: "What goes wrong and whether it is getting better", href: "/mistakes", icon: "chart", words: "errors weak" },
	{ title: "Mix-ups lesson", hint: "Words you give one for the other", href: "/lesson?mode=mixups", icon: "mix", words: "confused" },
	{ title: "Curriculum", hint: "Your climb, level by level and chapter by chapter", href: "/curriculum", icon: "arrow", words: "climb path levels chapters" },
	{ title: "Progress", hint: "Hours, stamps, the plan's pace", href: "/progress", icon: "chart", words: "plan stamps hours" },
	{ title: "Milestones", hint: "When you can handle real situations", href: "/milestones", icon: "flag", words: "level exam" },
	{ title: "Sources", hint: "The research behind each task", href: "/sources", icon: "read", words: "research studies evidence papers references" },
	{ title: "Ask the tutor", hint: "Any question about the language", href: "/chat/new", icon: "tutor", words: "chat" },
];

function useUnits(active: boolean) {
	const [units, setUnits] = useState<Array<{ id: string; title: string }>>([]);
	const loaded = useRef(false);
	useEffect(() => {
		if (!active || loaded.current) return;
		loaded.current = true;
		void fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => (r.ok ? (r.json() as Promise<{ units?: Array<{ id: string; title: string }> }>) : null))
			.then((s) => setUnits((s?.units ?? []).map((u) => ({ id: u.id, title: u.title }))))
			.catch(() => {
				loaded.current = false;
			});
	}, [active]);
	return units;
}

export function JumpProvider({ children }: { children: React.ReactNode }) {
	const [shown, setShown] = useState(false);
	const [letters, setLetters] = useState(false);
	const open = useCallback((withLetters = false) => {
		setLetters(withLetters);
		setShown(true);
	}, []);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setLetters(false);
				setShown((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	return (
		<JumpContext.Provider value={{ open }}>
			{children}
			{shown && <JumpPalette letters={letters} onClose={() => setShown(false)} />}
		</JumpContext.Provider>
	);
}

function JumpPalette({ letters: lettersOpen, onClose }: { letters: boolean; onClose: () => void }) {
	const router = useRouter();
	const { toggle, open: sidebarOpen } = useSidebar();
	const settings = useSettingsDialog();
	const [q, setQ] = useState("");
	const [sel, setSel] = useState(0);
	const [letters, setLetters] = useState(lettersOpen);
	const input = useRef<HTMLInputElement>(null);
	const units = useUnits(true);

	useEffect(() => {
		input.current?.focus();
	}, []);

	const places = useMemo<Place[]>(() => {
		const out: Place[] = ROUTES.map((r) => ({ id: r.href, title: r.title, hint: r.hint, icon: <QIcon name={r.icon} />, words: r.words, run: (go) => go(r.href) }));
		for (const u of units) out.push({ id: `unit-${u.id}`, title: u.title, hint: "Lesson", icon: <QIcon name="grammar" />, run: (go) => go(`/lesson?unit=${u.id}`) });
		out.push({ id: "settings", title: "Settings", hint: "AI keys, learning, sound, appearance", icon: <QIcon name="gear" />, words: "keys api options theme day night", run: () => settings.open() });
		out.push({ id: "sidebar", title: sidebarOpen ? "Hide the sidebar" : "Show the sidebar", hint: "Your tutor chats", icon: <QIcon name="tutor" />, words: "chats sessions", run: () => toggle() });
		return out;
	}, [units, settings, sidebarOpen, toggle]);

	const shown = useMemo(() => {
		const query = q.trim();
		if (!query) return places.slice(0, 12);
		return places
			.map((p) => ({ p, score: fuzzyScore(query, p.title, p.hint, p.words ?? "") }))
			.filter((x): x is { p: Place; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 12)
			.map((x) => x.p);
	}, [places, q]);

	const run = (p: Place | undefined) => {
		if (!p) return;
		onClose();
		p.run((href) => router.push(href));
	};

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]" data-testid="jump-palette" role="dialog" aria-modal="true" aria-label="Find a word, a unit, or a task">
			<div className="lh-fade absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden="true" />
			<div className="lh-menu-in origin-top q-card relative w-full max-w-[640px] overflow-hidden" style={{ boxShadow: "var(--q-raise-hi)" }}>
				<div className="flex items-center gap-2.5 border-b border-border px-3.5" style={{ height: 52 }}>
					<QIcon name="search" className="size-[17px] text-ink-3" />
					<input
						ref={input}
						value={q}
						onChange={(e) => {
							setQ(e.target.value);
							setSel(0);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") onClose();
							else if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(shown.length - 1, s + 1)));
							else if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
							else if (e.key === "Enter") (e.preventDefault(), run(shown[sel]));
						}}
						placeholder="Find a word, a unit, or a task…"
						aria-label="Find a word, a unit, or a task"
						className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-ink-3"
						autoComplete="off"
						spellCheck={false}
					/>
					<button type="button" className="q-letter" aria-label="Special letters" aria-pressed={letters} onClick={() => setLetters((v) => !v)}>
						ä
					</button>
					<kbd className="q-kbd">Esc</kbd>
				</div>
				{letters && (
					<div className="flex flex-wrap gap-1 border-b border-border bg-well px-3 py-2" data-testid="jump-letters">
						{SLOVAK_LETTERS.map((l) => (
							<button key={l} type="button" className="q-letter bg-background shadow-[0_0_0_1px_var(--q-line-2)]" onMouseDown={(e) => e.preventDefault()} onClick={() => input.current && insertAtCaret(input.current, l)}>
								{l}
							</button>
						))}
					</div>
				)}
				<ul className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
					{shown.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing here matches.</li>}
					{shown.map((p, i) => (
						<li key={p.id} role="option" aria-selected={i === sel}>
							<button type="button" onMouseMove={() => setSel(i)} onClick={() => run(p)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === sel && "bg-well")}>
								<span className="text-ink-3">{p.icon}</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[14px] text-foreground">{p.title}</span>
									<span className="block truncate text-[12px] text-ink-3">{p.hint}</span>
								</span>
								{i === sel && (
									<kbd className="q-kbd">
										<QIcon name="enter" />
									</kbd>
								)}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
