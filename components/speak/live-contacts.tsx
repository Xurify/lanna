"use client";

import type { CSSProperties, ReactNode } from "react";
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
