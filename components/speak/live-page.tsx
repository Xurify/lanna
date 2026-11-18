"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakHeader } from "@/components/speak/speak-header";
import { LiveContacts, LiveDial } from "@/components/speak/variants/live-picks";
import { LoaderCircleIcon, MicIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveCall, type LivePhase } from "@/components/speak/live-session";
import { LivePlayer } from "@/components/speak/live-player";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { SessionReport } from "@/components/speak/session-report";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import {
	liveProviderLabel,
	type LiveCallInput,
	type LivePageData,
	type LiveProviderId,
	type LiveStart,
	type LiveTalkResult,
	type LiveToolEvent,
	type LiveTurn,
} from "@/src/core";

type Target = { kind: "scene" | "island"; ref: string; title: string } | null;

export function LivePage({
	initial,
	target,
	layout = "contacts",
}: {
	initial: LivePageData;
	target: Target;
	layout?: string;
}) {
	const page = initial;
	const [phase, setPhase] = useState<"pick" | "ready" | "call" | "report">(target ? "ready" : "pick");
	const [start, setStart] = useState<LiveStart | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [speaker, setSpeaker] = useState<"tutor" | "learner" | null>(null);
	const [notice, setNotice] = useState("");
	const [callPhase, setCallPhase] = useState<LivePhase>("connecting");
	const [turns, setTurns] = useState<LiveTurn[]>([]);
	const [hint, setHint] = useState<LiveToolEvent | null>(null);
	const [used, setUsed] = useState<string[]>([]);
	const [level, setLevel] = useState(0);
	const [elapsed, setElapsed] = useState(0);
	const [result, setResult] = useState<LiveTalkResult | null>(null);
	const [engine, setEngine] = useState<LiveProviderId | null>(page.availability.provider ?? null);
	const enabled = page.availability.options.filter((o) => o.enabled);
	const call = useRef<LiveCall | null>(null);
	const startedAt = useRef(0);

	useEffect(() => {
		if (phase !== "call" || !start || call.current) return;
		startedAt.current = Date.now();
		const live = new LiveCall(start, {
			onPhase: (p) => setCallPhase(p),
			onTurns: setTurns,
			onLevel: setLevel,
			onSpeaker: setSpeaker,
			onNotice: setNotice,
			onTool: (event) => {
				if (event.tool === "prompt_repair") setHint(event);
				if (event.tool === "vault_word_used" && event.lemma)
					setUsed((current) => (current.includes(event.lemma!) ? current : [...current, event.lemma!]));
			},
			onFinish: (input, reason) => {
				if (!input) {
					setError("Nothing was heard, so there is nothing to read. Check the microphone and try again.");
					setPhase("pick");
					return;
				}
				void save(input, reason);
			},
		});
		call.current = live;
		live.begin().catch((err: unknown) => {
			call.current = null;
			setError(err instanceof Error ? err.message : String(err));
			setPhase("pick");
		});
	}, [phase, start]);

	useEffect(() => {
		if (phase !== "call" || callPhase === "ended") return;
		const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
		return () => clearInterval(timer);
	}, [phase, callPhase]);

	useEffect(() => () => call.current?.abort(), []);

	async function save(input: LiveCallInput, reason: string) {
		void reason;
		setPhase("report");
		try {
			const res = await fetch("/api/speak/live/end", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ...input, tz: new Date().getTimezoneOffset() }),
			});
			const data = (await res.json().catch(() => ({}))) as LiveTalkResult & { message?: string };
			if (!res.ok || !data.report) throw new Error(data.message ?? `Something went wrong (${res.status}).`);
			setResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setResult(null);
			setPhase("pick");
		} finally {
			call.current = null;
		}
	}

	async function beginCall(kind: "scene" | "island", ref: string, title?: string) {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/speak/live", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ kind, ref, provider: engine ?? undefined }),
			});
			const data = (await res.json().catch(() => ({}))) as LiveStart & { message?: string };
			if (!res.ok || !data.token) throw new Error(data.message ?? `Could not start (${res.status}).`);
			setStart(title ? { ...data, title } : data);
			setTurns([]);
			setHint(null);
			setUsed([]);
			setElapsed(0);
			setCallPhase("connecting");
			setPhase("call");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}

	const endCall = () => void call.current?.finish("You ended the talk.");

	if (result) {
		return (
			<SessionReport
				report={result.report}
				next={result.next}
				againHref={result.report.kind === "island" ? `/speak/islands?id=${result.report.ref}` : "/speak/live"}
				onAgain={() => {
					setResult(null);
					setTurns([]);
					setHint(null);
					setUsed([]);
					setElapsed(0);
					setStart(null);
					if (start) void beginCall(start.kind, start.ref, start.title);
				}}
			/>
		);
	}

	if (phase === "call" && start) {
		return (
			<LivePlayer
				title={start.title}
				turns={turns}
				hint={hint}
				used={used}
				vault={start.vault}
				level={level}
				speaker={speaker}
				elapsed={elapsed}
				phase={callPhase === "ended" ? "ending" : callPhase}
				notice={callPhase === "ending" && !notice ? "Reading the talk…" : notice}
				lang={start.language}
				onEnd={endCall}
			/>
		);
	}

	if (phase === "ready" && (start || target)) {
		const title = start?.title ?? target?.title ?? "";
		return (
			<div className="mx-auto max-w-3xl px-5 pt-[5vh] pb-24">
				<SpeakHeader
					title={title}
					back={{ href: "/speak/live", label: "Live call" }}
					lead="The tutor asks about the topic and answers what you actually said. Either of you can interrupt."
				/>
				{enabled.length > 1 ? (
					<div className="mt-4 flex flex-wrap items-center gap-2" data-testid="live-engine-picker">
						<span className="font-ui text-[12px] text-ink-3">Voice</span>
						<ChoiceMenu
							quiet
							value={engine ?? enabled[0]!.id}
							options={enabled.map((option) => ({ value: option.id, label: option.label }))}
							onChange={(next) => setEngine(next as LiveProviderId)}
							ariaLabel="Voice engine"
						/>
					</div>
				) : (
					<p className="mt-2 font-ui text-[12px] text-ink-3" data-testid="live-engine">
						Voice: {liveProviderLabel(engine ?? start?.provider ?? page.availability.provider ?? "phonic")}
					</p>
				)}
				<div className="mt-5 flex flex-wrap items-center gap-3">
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							if (start) {
								setTurns([]);
								setHint(null);
								setUsed([]);
								setElapsed(0);
								setCallPhase("connecting");
								setPhase("call");
							} else if (target) void beginCall(target.kind, target.ref, target.title);
						}}
						className={PRIMARY}
						data-testid="live-start"
					>
						{busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : <MicIcon className="size-4" />}
						{busy ? "Connecting…" : "Start the call"}
					</button>
					<p className="font-prose text-[13px] text-ink-3">Your browser will ask for the microphone.</p>
				</div>
				{error && (
					<p role="alert" className="mt-4 max-w-prose font-prose text-[14px] text-destructive">
						{error}
					</p>
				)}
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl px-5 pt-[5vh] pb-24">
			<SpeakHeader
				title="Live call"
				lead="Talk freely; either of you can interrupt. When you hang up, you see what to repair and the fillers to reach for next time."
			/>

			{layout !== "ledger" &&
				(() => {
					const blocked = (
						<div className="rounded-xl bg-well p-4" data-testid="live-unavailable">
							<p className="font-ui text-[13px] font-[600] text-ink-2">
								{page.availability.missing === "language" ? "Not in this language" : "Needs a key"}
							</p>
							<p className="mt-1 max-w-prose font-prose text-[14px] text-ink-2">{page.availability.reason}</p>
						</div>
					);
					const voice =
						enabled.length > 1 ? (
							<div className="flex flex-wrap items-center gap-2" data-testid="live-engine-picker">
								<span className="font-ui text-[12px] text-ink-3">Voice</span>
								<ChoiceMenu
									quiet
									value={engine ?? enabled[0]!.id}
									options={enabled.map((option) => ({ value: option.id, label: option.label }))}
									onChange={(next) => setEngine(next as LiveProviderId)}
									ariaLabel="Voice engine"
								/>
							</div>
						) : (
							<p className="font-ui text-[12px] text-ink-3" data-testid="live-engine">
								Voice: {enabled[0]?.label}
							</p>
						);
					const Pick = layout === "dial" ? LiveDial : LiveContacts;
					return (
						<Pick
							page={page}
							busy={busy}
							onCall={(kind, ref, title) => void beginCall(kind, ref, title)}
							engine={voice}
							blocked={blocked}
						/>
					);
				})()}
			{layout === "ledger" &&
				(!page.availability.enabled ? (
					<div className="mt-8 rounded-xl bg-well p-4" data-testid="live-unavailable">
						<p className="font-ui text-[13px] font-[600] text-ink-2">
							{page.availability.missing === "language" ? "Not in this language" : "Needs a key"}
						</p>
						<p className="mt-1 max-w-prose font-prose text-[14px] text-ink-2">{page.availability.reason}</p>
					</div>
				) : (
					<>
						{enabled.length > 1 && (
							<div className="mt-5 flex flex-wrap items-center gap-2" data-testid="live-engine-picker">
								<span className="font-ui text-[12px] text-ink-3">Voice</span>
								<ChoiceMenu
									quiet
									value={engine ?? enabled[0]!.id}
									options={enabled.map((option) => ({ value: option.id, label: option.label }))}
									onChange={(next) => setEngine(next as LiveProviderId)}
									ariaLabel="Voice engine"
								/>
							</div>
						)}
						{enabled.length === 1 && (
							<p className="mt-4 font-ui text-[12px] text-ink-3" data-testid="live-engine">
								Voice: {enabled[0]!.label}
							</p>
						)}
						{page.islands.length > 0 && (
							<section className="mt-9" aria-labelledby="live-islands">
								<h2 id="live-islands" className="q-sh">
									Your islands
								</h2>
								<p className="-mt-1 mb-2 font-prose text-[13px] text-ink-3">
									The talk that moves an island up its ladder.
								</p>
								<ul className="divide-y divide-[var(--q-line)]">
									{page.islands.map((island) => (
										<li key={island.id} className="flex items-baseline justify-between gap-3 py-2.5">
											<span className="min-w-0">
												<span className="block font-ui text-[15px] font-[600] text-foreground">{island.topic}</span>
												<span className="mt-0.5 block font-prose text-[13px] text-ink-3">
													{island.step}
													{island.needs[0] ? ` · ${island.needs[0]}` : ""}
												</span>
											</span>
											<button
												type="button"
												disabled={busy}
												onClick={() => void beginCall("island", island.id, island.topic)}
												className={cn(SECONDARY, "shrink-0")}
											>
												Talk
											</button>
										</li>
									))}
								</ul>
							</section>
						)}

						<section className="mt-9" aria-labelledby="live-scenes">
							<h2 id="live-scenes" className="q-sh">
								Scenes
							</h2>
							<p className="-mt-1 mb-2 font-prose text-[13px] text-ink-3">
								The same situations as Speak, spoken live instead of turn by turn.
							</p>
							<ul className="divide-y divide-[var(--q-line)]">
								{page.scenes.map((scene) => (
									<li key={scene.id} className="flex items-baseline justify-between gap-3 py-2.5">
										<span className="min-w-0">
											<span className="block font-ui text-[15px] font-[600] text-foreground">{scene.title}</span>
											<span className="mt-0.5 block font-prose text-[13px] text-ink-3">{scene.task}</span>
										</span>
										<button
											type="button"
											disabled={busy}
											onClick={() => void beginCall("scene", scene.id, scene.title)}
											className={cn(SECONDARY, "shrink-0")}
										>
											Talk
										</button>
									</li>
								))}
							</ul>
						</section>
					</>
				))}

			{error && (
				<p role="alert" className="mt-5 max-w-prose font-prose text-[14px] text-destructive">
					{error}
				</p>
			)}

			<p className="mt-10 max-w-2xl font-ui text-[12px] text-ink-3">
				Live talk runs on your own key, on {enabled.length > 1 ? "either engine" : "the engine you have a key for"}:{" "}
				Phonic-1 or OpenAI Realtime. Both voices are generated during the call; the transcript and the report stay on
				this computer.
			</p>
		</div>
	);
}
