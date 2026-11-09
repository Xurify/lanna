"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { wordMatch } from "@/src/core/speak";
import type { ProbeItem, CheckItemRecord } from "@/src/core/experiment";

interface WeeklyCheckPlayerProps {
	initialWeek?: number;
	initialLang?: "russian" | "slovak";
}

type CheckPhase = "intro" | "probes" | "production" | "complete";

export function WeeklyCheckPlayer({ initialWeek = 1, initialLang = "russian" }: WeeklyCheckPlayerProps = {}) {
	const [week, setWeek] = useState(initialWeek);
	const [lang, setLang] = useState<"russian" | "slovak">(initialLang);
	const [phase, setPhase] = useState<CheckPhase>("intro");

	const [loading, setLoading] = useState(false);
	const [probes, setProbes] = useState<ProbeItem[]>([]);
	const [production, setProduction] = useState<ProbeItem[]>([]);

	// Current probe item (0..9)
	const [probeIndex, setProbeIndex] = useState(0);
	const [probePlayed, setProbePlayed] = useState(false);
	const [probeAudioPlaying, setProbeAudioPlaying] = useState(false);
	const [probeInput, setProbeInput] = useState("");
	const [probeFeedback, setProbeFeedback] = useState<{ verdict: string; score: number } | null>(null);

	// Current production item (0..4)
	const [prodIndex, setProdIndex] = useState(0);
	const [prodInput, setProdInput] = useState("");
	const [prodFeedback, setProdFeedback] = useState<{ score: number; missing: string[]; extra: string[] } | null>(null);
	const [isRecording, setIsRecording] = useState(false);

	// Completed results
	const [results, setResults] = useState<CheckItemRecord[]>([]);
	const [saved, setSaved] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Fetch items whenever week or lang changes
	useEffect(() => {
		async function loadItems() {
			setLoading(true);
			try {
				const res = await fetch(`/api/experiments/input-first/check?week=${week}&lang=${lang}`);
				if (res.ok) {
					const data = await res.json();
					setProbes(data.probes || []);
					setProduction(data.production || []);
				}
			} catch (err) {
				console.error("Failed to load check items:", err);
			} finally {
				setLoading(false);
			}
		}
		loadItems();
	}, [week, lang]);

	const langCode = lang === "russian" ? "ru" : "sk";

	function playProbeAudio(text: string) {
		if (probeAudioPlaying) return;
		setProbeAudioPlaying(true);
		setProbePlayed(true);

		const url = `/api/tts?lang=${langCode}&text=${encodeURIComponent(text)}`;
		const audio = new Audio(url);
		audioRef.current = audio;
		audio.onended = () => setProbeAudioPlaying(false);
		audio.onerror = () => setProbeAudioPlaying(false);
		audio.play().catch(() => setProbeAudioPlaying(false));
	}

	function clean(text: string) {
		return text.toLowerCase().trim().replace(/[.,!?:;«»""'']/g, "");
	}

	function submitProbe() {
		const current = probes[probeIndex];
		if (!current) return;

		const given = clean(probeInput);
		const expected = clean(current.targetSentence);

		const isExact = given === expected;
		const isAccents = given.normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
			expected.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

		const verdict = isExact ? "exact" : isAccents ? "accents" : "wrong";
		const score = verdict === "exact" || verdict === "accents" ? 1 : 0;

		const record: CheckItemRecord = {
			date: new Date().toISOString().slice(0, 10),
			week,
			dayNumber: week * 7,
			language: lang,
			type: "probe",
			itemId: current.id,
			prompt: "Listening Dictation (single play)",
			expected: current.targetSentence,
			response: probeInput.trim(),
			score,
			verdict,
		};

		setProbeFeedback({ verdict, score });
		setResults((prev) => [...prev, record]);
	}

	function nextProbe() {
		setProbeFeedback(null);
		setProbeInput("");
		setProbePlayed(false);
		if (probeIndex < probes.length - 1) {
			setProbeIndex(probeIndex + 1);
		} else {
			setPhase("production");
		}
	}

	function submitProduction(responseOverride?: string) {
		const current = production[prodIndex];
		if (!current) return;

		const text = (responseOverride ?? prodInput).trim();
		const match = wordMatch(current.targetSentence, text);
		const score = Math.round(match.score * 100) / 100;
		const verdict = score >= 0.8 ? "clear" : score >= 0.5 ? "partial" : "not-yet";

		const record: CheckItemRecord = {
			date: new Date().toISOString().slice(0, 10),
			week,
			dayNumber: week * 7,
			language: lang,
			type: "production",
			itemId: current.id,
			prompt: current.englishTranslation,
			expected: current.targetSentence,
			response: text,
			score,
			verdict,
			engine: responseOverride ? "stt" : "typed",
		};

		setProdFeedback({ score, missing: match.missing, extra: match.extra });
		setResults((prev) => [...prev, record]);
	}

	function nextProduction() {
		setProdFeedback(null);
		setProdInput("");
		if (prodIndex < production.length - 1) {
			setProdIndex(prodIndex + 1);
		} else {
			finishCheck();
		}
	}

	async function finishCheck() {
		setPhase("complete");
		setLoading(true);
		try {
			const res = await fetch("/api/experiments/input-first/check", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items: results }),
			});
			if (res.ok) {
				setSaved(true);
			} else {
				setSaveError("Failed to save check results");
			}
		} catch (err) {
			setSaveError(String(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-xl">
			{/* Phase: INTRO */}
			{phase === "intro" && (
				<div className="space-y-6">
					<div>
						<span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
							Weekly Check Session
						</span>
						<h2 className="text-2xl font-bold mt-2 text-white">Sunday Assessment Protocol</h2>
						<p className="text-sm text-neutral-400 mt-1">
							10 Listening Dictation Probes (played once, typed) followed by 5 Spoken Production Prompts.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">Language</label>
							<select
								value={lang}
								onChange={(e) => setLang(e.target.value as "russian" | "slovak")}
								className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200"
							>
								<option value="russian">Russian (Treatment)</option>
								<option value="slovak">Slovak (Control)</option>
							</select>
						</div>
						<div>
							<label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">Study Week</label>
							<select
								value={week}
								onChange={(e) => setWeek(Number(e.target.value))}
								className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200"
							>
								{[1, 2, 3, 4, 5, 6].map((w) => (
									<option key={w} value={w}>
										Week {w} (Day {w * 7})
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-2 text-xs text-neutral-300">
						<div className="font-semibold text-neutral-200">Protocol Constraints (SCED v3):</div>
						<ul className="list-disc list-inside space-y-1 text-neutral-400">
							<li>Listening probes test first-play understanding. Audio plays only once.</li>
							<li>Production prompts give English cues; you speak or type the target translation.</li>
							<li>Responses are scored against verified lexicon sentences and saved automatically.</li>
						</ul>
					</div>

					<button
						onClick={() => {
							setResults([]);
							setProbeIndex(0);
							setProdIndex(0);
							setPhase("probes");
						}}
						disabled={loading || probes.length === 0}
						className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition shadow"
					>
						{loading ? "Loading items..." : "Start Week " + week + " Check &rarr;"}
					</button>
				</div>
			)}

			{/* Phase: LISTENING PROBES */}
			{phase === "probes" && probes[probeIndex] && (
				<div className="space-y-6">
					<div className="flex items-center justify-between border-b border-neutral-800 pb-3">
						<span className="text-xs uppercase font-semibold text-neutral-400">
							Part 1: Listening Probe ({probeIndex + 1} of {probes.length})
						</span>
						<span className="text-xs font-mono text-neutral-400">Week {week} &bull; {lang}</span>
					</div>

					<div className="text-center py-6 space-y-4">
						<button
							onClick={() => playProbeAudio(probes[probeIndex]!.targetSentence)}
							disabled={probePlayed || probeAudioPlaying}
							className={`px-6 py-4 rounded-2xl font-semibold text-sm transition flex items-center gap-3 mx-auto shadow-lg ${
								probePlayed
									? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50"
									: "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse"
							}`}
						>
							<svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
							{probeAudioPlaying ? "Playing audio..." : probePlayed ? "Audio Played (Single Play)" : "Play Audio Clip"}
						</button>
						<p className="text-xs text-neutral-400">
							{probePlayed ? "Type exactly what you heard below:" : "Click play to listen to the sentence once."}
						</p>
					</div>

					<div className="space-y-3">
						<input
							type="text"
							value={probeInput}
							onChange={(e) => setProbeInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !probeFeedback && probeInput.trim()) submitProbe();
								else if (e.key === "Enter" && probeFeedback) nextProbe();
							}}
							disabled={!probePlayed || !!probeFeedback}
							placeholder={probePlayed ? "Type in " + lang + "..." : "Listen to audio first..."}
							className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
							autoFocus
						/>

						{probeFeedback && (
							<div
								className={`p-4 rounded-xl border text-xs space-y-1 ${
									probeFeedback.score === 1
										? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
										: "bg-rose-950/70 border-rose-800 text-rose-300"
								}`}
							>
								<div className="font-semibold uppercase tracking-wider">
									{probeFeedback.score === 1 ? "✓ Understood" : "✗ Not understood on first play"}
								</div>
								<div>Expected: <span className="font-mono text-neutral-200">{probes[probeIndex]!.targetSentence}</span></div>
								<div>English: <span className="text-neutral-400">{probes[probeIndex]!.englishTranslation}</span></div>
							</div>
						)}
					</div>

					<div className="flex justify-end pt-2">
						{!probeFeedback ? (
							<button
								onClick={submitProbe}
								disabled={!probePlayed || !probeInput.trim()}
								className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 font-medium rounded-xl text-xs transition"
							>
								Submit Answer &rarr;
							</button>
						) : (
							<button
								onClick={nextProbe}
								className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs transition"
							>
								Next Probe &rarr;
							</button>
						)}
					</div>
				</div>
			)}

			{/* Phase: PRODUCTION PROMPTS */}
			{phase === "production" && production[prodIndex] && (
				<div className="space-y-6">
					<div className="flex items-center justify-between border-b border-neutral-800 pb-3">
						<span className="text-xs uppercase font-semibold text-amber-400">
							Part 2: Spoken Production ({prodIndex + 1} of {production.length})
						</span>
						<span className="text-xs font-mono text-neutral-400">Week {week} &bull; {lang}</span>
					</div>

					<div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-2">
						<span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
							Translate to {lang}
						</span>
						<div className="text-lg md:text-xl font-medium text-white">
							"{production[prodIndex]!.englishTranslation}"
						</div>
					</div>

					<div className="space-y-3">
						<input
							type="text"
							value={prodInput}
							onChange={(e) => setProdInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !prodFeedback && prodInput.trim()) submitProduction();
								else if (e.key === "Enter" && prodFeedback) nextProduction();
							}}
							disabled={!!prodFeedback}
							placeholder={`Type or speak the ${lang} sentence...`}
							className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
							autoFocus
						/>

						{prodFeedback && (
							<div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 text-xs space-y-1">
								<div className="flex items-center justify-between">
									<span className="font-semibold text-neutral-200">
										Accuracy Score: {Math.round(prodFeedback.score * 100)}%
									</span>
									<span className="capitalize text-neutral-400">
										{prodFeedback.score >= 0.8 ? "Clear" : prodFeedback.score >= 0.5 ? "Partial" : "Needs Practice"}
									</span>
								</div>
								<div>Expected: <span className="font-mono text-neutral-300">{production[prodIndex]!.targetSentence}</span></div>
								{prodFeedback.missing.length > 0 && (
									<div className="text-rose-400">Missing words: {prodFeedback.missing.join(", ")}</div>
								)}
								{prodFeedback.extra.length > 0 && (
									<div className="text-amber-400">Extra words: {prodFeedback.extra.join(", ")}</div>
								)}
							</div>
						)}
					</div>

					<div className="flex justify-end pt-2">
						{!prodFeedback ? (
							<button
								onClick={() => submitProduction()}
								disabled={!prodInput.trim()}
								className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 font-medium rounded-xl text-xs transition"
							>
								Check Production &rarr;
							</button>
						) : (
							<button
								onClick={nextProduction}
								className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-xs transition"
							>
								{prodIndex < production.length - 1 ? "Next Prompt \u2192" : "Complete Check \u2192"}
							</button>
						)}
					</div>
				</div>
			)}

			{/* Phase: COMPLETE */}
			{phase === "complete" && (
				<div className="text-center space-y-6 py-4">
					<div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
						✓
					</div>
					<div>
						<h2 className="text-2xl font-bold text-white">Week {week} Check Complete!</h2>
						<p className="text-sm text-neutral-400 mt-1">
							All 15 assessment items recorded to <code className="text-xs bg-neutral-800 px-1 py-0.5 rounded">checks.jsonl</code>.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
						<div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
							<div className="text-xs text-neutral-400 uppercase font-semibold">Listening Probes</div>
							<div className="text-2xl font-bold text-emerald-400 mt-1">
								{results.filter((r) => r.type === "probe" && r.score === 1).length} / 10
							</div>
							<div className="text-[11px] text-neutral-400 mt-1">First-play accuracy</div>
						</div>
						<div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
							<div className="text-xs text-neutral-400 uppercase font-semibold">Spoken Production</div>
							<div className="text-2xl font-bold text-amber-400 mt-1">
								{Math.round(
									(results.filter((r) => r.type === "production").reduce((a, b) => a + b.score, 0) / 5) * 100
								)}%
							</div>
							<div className="text-[11px] text-neutral-400 mt-1">Average word match</div>
						</div>
					</div>

					{saved && (
						<p className="text-xs text-emerald-400 font-mono">
							✓ Synced with experiment summary & statistical regression.
						</p>
					)}
					{saveError && (
						<p className="text-xs text-rose-400 font-mono">
							⚠ {saveError}
						</p>
					)}

					<div className="pt-2">
						<Link
							href="/experiments/input-first"
							className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-xl text-xs transition"
						>
							&larr; Return to Experiment Dashboard
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
