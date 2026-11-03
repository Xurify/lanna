"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV, navItemFor } from "@/lib/nav";
import { NAV_ICONS } from "@/components/language-switcher";

/**
 * The sidebar, collapsed: a 56 px column of the same doors, shown beside the
 * full-screen task screens (a lesson, Listen, Speak, Fluency, Read, Watch).
 * Those screens used to cover the sidebar completely, so leaving one meant
 * finding the small X; now every page is one press away and the screen keeps
 * its focus. Names are in the tooltip and the accessible label. From 768 px up;
 * a phone keeps the drawer and the screens' own X.
 */
export function NavRail() {
	const pathname = usePathname();
	const active = navItemFor(pathname)?.id;
	return (
		<nav aria-label="Pages" data-testid="nav-rail" className={cn("lh-no-drag flex-col items-center gap-1 overflow-y-auto bg-side pb-3 pt-14 shadow-[inset_-1px_0_0_var(--q-line)]", "fixed inset-y-0 left-0 z-40 hidden w-14 md:flex")}>
			{NAV.map((group, g) => (
				<div key={group.id} className={cn("flex flex-col items-center gap-1", g > 0 && "mt-2 border-t border-border pt-2")}>
					{group.items.map((item) => {
						const Icon = NAV_ICONS[item.id];
						const on = active === item.id;
						return (
							<Link
								key={item.id}
								href={item.href}
								title={item.label}
								aria-label={item.label}
								aria-current={on ? "page" : undefined}
								data-testid={`rail-${item.id}`}
								className={cn("lh-press relative flex size-10 items-center justify-center rounded-lg", on ? "bg-accent text-sun" : "text-ink-3 hover:bg-accent/60 hover:text-foreground")}
							>
								{on && <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-sun" aria-hidden="true" />}
								<Icon className="size-[18px]" />
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}
