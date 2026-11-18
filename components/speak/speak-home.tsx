import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveAvailability } from "@/src/core";
import { SpeakHeader } from "@/components/speak/speak-header";
import { SPEAK_WAYS, type SpeakWay } from "@/components/speak/speak-ways";

const FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function blockedNote(way: SpeakWay, live: LiveAvailability): string | null {
	if (way.id !== "live" || live.enabled) return null;
	return live.missing === "language" ? "Not in this language yet" : "Needs an API key";
}

export function SpeakHome({ live }: { live: LiveAvailability }) {
	const [lead, ...rest] = SPEAK_WAYS;
	if (!lead) return null;
	return (
		<div className="@container mx-auto w-full max-w-4xl px-5 pt-[5vh] pb-24 @md:px-6">
			<SpeakHeader title="Speak" back={{ href: "/", label: "Today" }} lead="Four ways to practice talking. Pick one." />
			<nav aria-label="Ways to speak" className="mt-8 flex flex-col gap-8" data-testid="speak-ways">
				<Link
					href={lead.href}
					data-testid={`speak-way-${lead.id}`}
					className={cn(
						"group grid grid-cols-1 items-center gap-6 rounded-2xl bg-well/60 p-6 transition-colors hover:bg-well @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] @2xl:p-8",
						FOCUS,
					)}
				>
					<span className="order-2 min-w-0 @2xl:order-1">
						<span className="block font-ui text-[26px] font-[600] tracking-[-0.025em] text-foreground">
							{lead.title}
						</span>
						<span className="mt-2 block max-w-sm font-prose text-[15px] leading-snug text-ink-2">{lead.line}</span>
						<span className="mt-5 inline-flex items-center gap-1.5 font-ui text-sm font-[550] text-teal-2">
							<span className="cap-center">Pick a scene</span>
							<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
						</span>
					</span>
					<span className="order-1 mx-auto block w-full max-w-md text-ink-2 transition-colors group-hover:text-foreground @2xl:order-2">
						<lead.Sketch />
					</span>
				</Link>
				<ul className="grid grid-cols-1 gap-6 @xl:grid-cols-3">
					{rest.map((way) => {
						const note = blockedNote(way, live);
						return (
							<li key={way.id}>
								<Link
									href={way.href}
									data-testid={`speak-way-${way.id}`}
									className={cn("group -m-2 block rounded-xl p-2 transition-colors hover:bg-well/50", FOCUS)}
								>
									<span className="mx-auto block max-w-xs text-ink-2 transition-colors group-hover:text-foreground">
										<way.Sketch />
									</span>
									<span className="mt-2 block font-ui text-[16px] font-[600] tracking-[-0.01em] text-foreground">
										{way.title}
									</span>
									<span className="mt-1 block font-prose text-[13px] leading-snug text-ink-3">{way.line}</span>
									{note && <span className="mt-2 block font-ui text-xs font-[550] text-ink-3">{note}</span>}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</div>
	);
}
