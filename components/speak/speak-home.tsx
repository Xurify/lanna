import Link from "next/link";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveAvailability } from "@/src/core";
import { SpeakHeader } from "@/components/speak/speak-header";
import { SPEAK_WAYS, type SpeakWay } from "@/components/speak/speak-ways";

export type SpeakHomeVariant = "gallery" | "ledger" | "spotlight";

export const SPEAK_HOME_VARIANTS: Array<{ id: SpeakHomeVariant; label: string }> = [
	{ id: "gallery", label: "Gallery · 2 × 2" },
	{ id: "ledger", label: "Ledger · four rows" },
	{ id: "spotlight", label: "Spotlight · one big, three small" },
];

const FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function blockedNote(way: SpeakWay, live: LiveAvailability): string | null {
	if (way.id !== "live" || live.enabled) return null;
	return live.missing === "language" ? "Not in this language yet" : "Needs an API key";
}

function Status({ note }: { note: string | null }) {
	if (!note) return null;
	return <span className="mt-2 block font-ui text-xs font-[550] text-ink-3">{note}</span>;
}

function Gallery({ live }: { live: LiveAvailability }) {
	return (
		<ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
			{SPEAK_WAYS.map((way) => (
				<li key={way.id}>
					<Link
						href={way.href}
						data-testid={`speak-way-${way.id}`}
						className={cn(
							"group flex h-full flex-col rounded-2xl bg-card p-5 shadow-[0_0_0_1px_var(--q-line)] transition-colors hover:bg-well/50",
							FOCUS,
						)}
					>
						<span className="block text-ink-2 transition-colors group-hover:text-foreground">
							<way.Sketch />
						</span>
						<span className="mt-3 flex items-center gap-2 font-ui text-[18px] font-[600] tracking-[-0.015em] text-foreground">
							{way.title}
							<ArrowRightIcon className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
						</span>
						<span className="mt-1 block font-prose text-[14px] leading-snug text-ink-3">{way.line}</span>
						<Status note={blockedNote(way, live)} />
					</Link>
				</li>
			))}
		</ul>
	);
}

function Ledger({ live }: { live: LiveAvailability }) {
	return (
		<ul className="divide-y divide-[var(--q-line)] border-y border-[var(--q-line)]">
			{SPEAK_WAYS.map((way) => (
				<li key={way.id}>
					<Link
						href={way.href}
						data-testid={`speak-way-${way.id}`}
						className={cn(
							"group -mx-3 grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-well/50 @xl:grid-cols-[13rem_minmax(0,1fr)_auto] @xl:gap-8",
							FOCUS,
						)}
					>
						<span className="block text-ink-2 transition-colors group-hover:text-foreground">
							<way.Sketch />
						</span>
						<span className="min-w-0">
							<span className="block font-ui text-[17px] font-[600] tracking-[-0.015em] text-foreground @xl:text-[20px]">
								{way.title}
							</span>
							<span className="mt-1 block font-prose text-[14px] leading-snug text-ink-3">{way.line}</span>
							<Status note={blockedNote(way, live)} />
						</span>
						<ChevronRightIcon className="size-5 text-ink-4 transition-colors group-hover:text-ink-2" />
					</Link>
				</li>
			))}
		</ul>
	);
}

function Spotlight({ live }: { live: LiveAvailability }) {
	const [lead, ...rest] = SPEAK_WAYS;
	if (!lead) return null;
	return (
		<div className="flex flex-col gap-8">
			<Link
				href={lead.href}
				data-testid={`speak-way-${lead.id}`}
				className={cn(
					"group grid grid-cols-1 items-center gap-6 rounded-2xl bg-well/60 p-6 transition-colors hover:bg-well @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] @2xl:p-8",
					FOCUS,
				)}
			>
				<span className="order-2 min-w-0 @2xl:order-1">
					<span className="block font-ui text-[26px] font-[600] tracking-[-0.025em] text-foreground">{lead.title}</span>
					<span className="mt-2 block max-w-sm font-prose text-[15px] leading-snug text-ink-2">{lead.line}</span>
					<span className="mt-5 inline-flex items-center gap-1.5 font-ui text-sm font-[550] text-teal-2">
						Pick a scene
						<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
					</span>
				</span>
				<span className="order-1 block text-ink-2 transition-colors group-hover:text-foreground @2xl:order-2">
					<lead.Sketch />
				</span>
			</Link>
			<ul className="grid grid-cols-1 gap-x-6 gap-y-6 @xl:grid-cols-3">
				{rest.map((way) => (
					<li key={way.id}>
						<Link
							href={way.href}
							data-testid={`speak-way-${way.id}`}
							className={cn("group -m-2 block rounded-xl p-2 transition-colors hover:bg-well/50", FOCUS)}
						>
							<span className="block text-ink-2 transition-colors group-hover:text-foreground">
								<way.Sketch />
							</span>
							<span className="mt-2 block font-ui text-[16px] font-[600] tracking-[-0.01em] text-foreground">
								{way.title}
							</span>
							<span className="mt-1 block font-prose text-[13px] leading-snug text-ink-3">{way.line}</span>
							<Status note={blockedNote(way, live)} />
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

export function SpeakHome({ live, variant }: { live: LiveAvailability; variant: SpeakHomeVariant }) {
	return (
		<div className="@container mx-auto w-full max-w-4xl px-5 pt-[5vh] pb-24 @md:px-6">
			<SpeakHeader title="Speak" back={{ href: "/", label: "Today" }} lead="Four ways to practice talking. Pick one." />
			<nav aria-label="Ways to speak" className="mt-8" data-testid="speak-ways">
				{variant === "ledger" ? (
					<Ledger live={live} />
				) : variant === "spotlight" ? (
					<Spotlight live={live} />
				) : (
					<Gallery live={live} />
				)}
			</nav>
		</div>
	);
}
