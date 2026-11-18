"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { PhoneIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LivePageData } from "@/src/core";
import { SceneArt } from "@/components/speak/scene-art";
import { CallStage } from "@/components/speak/speak-motion";

type Contact = { kind: "scene" | "island"; id: string; title: string; line: string };

export interface LivePickProps {
	page: LivePageData;
	busy: boolean;
	onCall: (kind: "scene" | "island", id: string, title: string) => void;
	engine: ReactNode;
	blocked: ReactNode;
}

function contactsOf(page: LivePageData): Contact[] {
	return [
		...page.islands.map((i) => ({
			kind: "island" as const,
			id: i.id,
			title: i.topic,
			line: i.needs[0] ? `${i.step} · ${i.needs[0]}` : i.step,
		})),
		...page.scenes.map((s) => ({ kind: "scene" as const, id: s.id, title: s.title, line: s.task })),
	];
}

function Avatar({ contact, size }: { contact: Contact; size: string }) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-well text-foreground shadow-[0_0_0_1px_var(--q-line)]",
				size,
			)}
			aria-hidden="true"
		>
			<SceneArt
				id={contact.kind === "island" ? `island-${contact.id}` : contact.id}
				text={contact.title}
				className="w-[150%] max-w-none translate-y-[6%]"
			/>
		</span>
	);
}

const CALL =
	"lanna-press flex shrink-0 items-center justify-center rounded-full bg-teal text-sun-ink transition-colors hover:bg-teal-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-3";

export function LiveContacts({ page, busy, onCall, engine, blocked }: LivePickProps) {
	const contacts = contactsOf(page);
	const enabled = page.availability.enabled;
	const groups = [
		{
			label: "Your islands",
			note: "A live talk moves an island up its ladder.",
			items: contacts.filter((c) => c.kind === "island"),
		},
		{ label: "Scenes", note: "The Speak scenes, spoken live.", items: contacts.filter((c) => c.kind === "scene") },
	].filter((g) => g.items.length > 0);
	return (
		<div className="@container mt-6">
			<CallStage speaker={null} level={0} connecting={false} />
			<div className="mt-4">{enabled ? engine : blocked}</div>
			<h2 className="mt-8 font-ui text-[20px] font-[600] tracking-[-0.015em] text-foreground">Who will you call?</h2>
			{groups.map((g) => (
				<section key={g.label} className="mt-5" aria-label={g.label}>
					<p className="font-ui text-[13px] font-[600] text-ink-2">
						{g.label} <span className="font-[450] text-ink-3">· {g.note}</span>
					</p>
					<ul className="speak-in mt-2 grid gap-2 @2xl:grid-cols-2">
						{g.items.map((c, i) => (
							<li
								key={`${c.kind}-${c.id}`}
								style={{ "--i": i } as CSSProperties}
								className="flex items-center gap-3 rounded-2xl bg-card p-2.5 pr-3 shadow-[0_0_0_1px_var(--q-line)]"
							>
								<Avatar contact={c} size="size-14" />
								<span className="min-w-0 flex-1">
									<span className="block overflow-x-clip font-ui text-[15px] font-[600] text-ellipsis whitespace-nowrap text-foreground">
										{c.title}
									</span>
									<span className="mt-0.5 line-clamp-1 font-prose text-[13px] text-ink-3" title={c.line}>
										{c.line}
									</span>
								</span>
								<button
									type="button"
									className={cn(CALL, "size-11")}
									disabled={!enabled || busy}
									onClick={() => onCall(c.kind, c.id, c.title)}
									aria-label={`Call: ${c.title}`}
								>
									<PhoneIcon className="size-[18px]" />
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

export function LiveDial({ page, busy, onCall, engine, blocked }: LivePickProps) {
	const contacts = contactsOf(page);
	const [pick, setPick] = useState(0);
	const enabled = page.availability.enabled;
	const hero = contacts[pick];
	if (!hero) return <div className="mt-6">{blocked}</div>;
	return (
		<div className="@container mt-6">
			<article
				key={`${hero.kind}-${hero.id}`}
				className="speak-deal grid items-center gap-6 rounded-3xl bg-well/50 p-6 shadow-[0_0_0_1px_var(--q-line)] @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:p-9"
			>
				<div className="flex min-w-0 items-center gap-5">
					<Avatar contact={hero} size="size-24 @2xl:size-32" />
					<div className="min-w-0">
						<p className="font-ui text-[13px] font-[550] text-teal-2">{hero.kind === "island" ? "Island" : "Scene"}</p>
						<h2 className="mt-0.5 font-ui text-[28px] leading-tight font-[600] tracking-[-0.025em] text-foreground @2xl:text-[34px]">
							{hero.title}
						</h2>
						<p className="mt-1 max-w-md font-prose text-[15px] text-ink-2">{hero.line}</p>
					</div>
				</div>
				<div className="flex flex-col items-center gap-2">
					<button
						type="button"
						className={cn(CALL, "size-20", enabled && !busy && "speak-voicing")}
						disabled={!enabled || busy}
						onClick={() => onCall(hero.kind, hero.id, hero.title)}
						aria-label={`Call: ${hero.title}`}
						data-testid="live-start"
					>
						<PhoneIcon className="size-8" />
					</button>
					<span className="font-ui text-xs font-[550] text-ink-3">
						{busy ? "Connecting…" : enabled ? "Call" : "Needs a key"}
					</span>
				</div>
			</article>
			<div className="mt-4">{enabled ? engine : blocked}</div>
			<h2 className="mt-8 font-ui text-[14px] font-[600] text-ink-2">Or someone else</h2>
			<ul className="speak-in mt-3 flex flex-wrap gap-2">
				{contacts.map((c, i) => (
					<li key={`${c.kind}-${c.id}`} style={{ "--i": i } as CSSProperties}>
						<button
							type="button"
							aria-pressed={i === pick}
							onClick={() => setPick(i)}
							className={cn(
								"lanna-press flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 font-ui text-[13px] font-[550] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
								i === pick ? "bg-foreground text-background" : "bg-well text-ink-2 hover:text-foreground",
							)}
						>
							<Avatar contact={c} size="size-7" />
							{c.title}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
