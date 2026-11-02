"use client";

/**
 * The phone bottom nav. Below Tailwind's md breakpoint (768px) five doors sit
 * in a bar at the foot of the screen, so Today, the Climb, Review, Stories and
 * Progress stay one tap away without opening the sidebar (Speak and Words are
 * a tap away on Today and in the drawer).
 *
 * It shows on those pages only (Progress also covers Milestones and the
 * map, as the sidebar does). Chat, lesson and player pages keep their own
 * bottom bars (composers, transport controls), so the nav never covers them.
 * The current door is lit by a sun bar above it and a sun icon, no pill
 * (trail design, 2026-11-02).
 */

import Link from "next/link";
import { BookOpenIcon, ChartNoAxesColumnIcon, type LucideIcon, MountainSnowIcon, RepeatIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DOORS: { href: string; label: string; icon: LucideIcon; testid: string; pages: readonly string[] }[] = [
	{ href: "/", label: "Today", icon: SunIcon, testid: "phone-today-door", pages: ["/"] },
	{ href: "/curriculum", label: "Climb", icon: MountainSnowIcon, testid: "phone-path-door", pages: ["/curriculum"] },
	{ href: "/review", label: "Review", icon: RepeatIcon, testid: "phone-review-door", pages: ["/review"] },
	{ href: "/read", label: "Stories", icon: BookOpenIcon, testid: "phone-stories-door", pages: ["/read"] },
	{ href: "/plan", label: "Progress", icon: ChartNoAxesColumnIcon, testid: "phone-plan-door", pages: ["/plan", "/milestones", "/map"] },
];

/** True on the pages that show the bar. The app shell pads its content
 *  for the bar on exactly these pages. */
export function isPhoneNavPath(pathname: string): boolean {
	return DOORS.some((d) => d.pages.includes(pathname));
}

export function PhoneNav({ pathname }: { pathname: string }) {
	if (!isPhoneNavPath(pathname)) return null;
	return (
		<nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
			{DOORS.map((d) => {
				const Icon = d.icon;
				const active = d.pages.includes(pathname);
				return (
					<Link
						key={d.href}
						href={d.href}
						data-testid={d.testid}
						aria-current={active ? "page" : undefined}
						className={cn(
							"relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 font-ui text-xs font-semibold transition-colors",
							active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-sun" aria-hidden="true" />}
						<Icon className={cn("size-5 shrink-0", active && "text-sun")} aria-hidden="true" />
						<span className="truncate">{d.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
