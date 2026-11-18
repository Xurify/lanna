import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { CapLabel } from "@/components/ui/cap-label";

/** The top of every Speak page: one way back, the page's name, at most one line on what it is for. */
export function SpeakHeader({
	title,
	lead,
	back = { href: "/speak", label: "Speak" },
	titleLang,
}: {
	title: ReactNode;
	lead?: ReactNode;
	back?: { href: string; label: string };
	titleLang?: string;
}) {
	return (
		<header>
			<Link
				href={back.href}
				className="lanna-wco-gutter inline-flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground"
				data-testid="speak-back"
			>
				<ArrowLeftIcon className="size-3.5" />
				<CapLabel>{back.label}</CapLabel>
			</Link>
			<h1 className="mt-1 font-ui text-[28px] font-[600] tracking-[-0.028em] text-foreground" lang={titleLang}>
				{title}
			</h1>
			{lead && <p className="mt-1 max-w-2xl font-prose text-[15px] text-ink-3">{lead}</p>}
		</header>
	);
}
