"use client";

/**
 * The phone bottom nav. Below Tailwind's md breakpoint (768px) the four main
 * doors sit in a bar at the foot of the screen, so Today, Plan, Review and the
 * Skill map stay one tap away without opening the sidebar.
 *
 * It shows on those four pages only (Plan also covers Milestones, as the
 * sidebar does). Chat, lesson and player pages keep their own bottom bars
 * (composers, transport controls), so the nav never covers them. Same doors,
 * icons and active rules as the sidebar's Main list.
 */

import Link from "next/link";
import { BookOpenIcon, type LucideIcon, MapIcon, RepeatIcon, SunIcon, TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DOORS: { href: string; label: string; icon: LucideIcon; tint: string; testid: string; pages: readonly string[] }[] = [
	{ href: "/", label: "Today", icon: SunIcon, tint: "text-gold", testid: "phone-today-door", pages: ["/"] },
	{ href: "/plan", label: "Plan", icon: TargetIcon, tint: "text-flame", testid: "phone-plan-door", pages: ["/plan", "/milestones"] },
	{ href: "/review", label: "Review", icon: RepeatIcon, tint: "text-sky", testid: "phone-review-door", pages: ["/review"] },
	{ href: "/map", label: "Skill map", icon: MapIcon, tint: "text-xp", testid: "phone-map-door", pages: ["/map"] },
	{ href: "/words", label: "Words", icon: BookOpenIcon, tint: "text-emerald", testid: "phone-words-door", pages: ["/words"] },
];

/** True on the pages that show the bar. The app shell pads its content
 *  for the bar on exactly these pages. */
export function isPhoneNavPath(pathname: string): boolean {
	return DOORS.some((d) => d.pages.includes(pathname));
}

export function PhoneNav({ pathname }: { pathname: string }) {
	if (!isPhoneNavPath(pathname)) return null;
	return (
		<nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background md:hidden">
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
							"flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 font-ui text-xs font-semibold transition-colors",
							active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className={cn("size-5 shrink-0", active && d.tint)} aria-hidden="true" />
						<span className="truncate">{d.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
