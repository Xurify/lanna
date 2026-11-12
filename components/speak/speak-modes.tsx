import Link from "next/link";
import { cn } from "@/lib/utils";

const MODES = [
	{ id: "tutor", href: "/speak", label: "With a tutor" },
	{ id: "solo", href: "/speak/self-talk", label: "On your own" },
] as const;

export function SpeakModes({ current }: { current: (typeof MODES)[number]["id"] }) {
	return (
		<nav aria-label="Ways to speak" className="inline-flex rounded-[10px] bg-well p-0.5">
			{MODES.map((m) => {
				const on = m.id === current;
				return (
					<Link
						key={m.id}
						href={m.href}
						aria-current={on ? "page" : undefined}
						data-testid={`speak-mode-${m.id}`}
						className={cn("rounded-[8px] px-3 py-1.5 font-ui text-[13px] font-[550] transition-colors pointer-coarse:py-2.5", on ? "bg-card text-foreground shadow-[0_0_0_1px_var(--q-line-2)]" : "text-ink-3 hover:text-ink-2")}
					>
						{m.label}
					</Link>
				);
			})}
		</nav>
	);
}
