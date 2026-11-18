import Link from "next/link";
import { ArrowLeftIcon, XIcon } from "lucide-react";

import { CapLabel } from "@/components/ui/cap-label";

export function TodayLink({ closes = false }: { closes?: boolean }) {
	const Icon = closes ? XIcon : ArrowLeftIcon;
	return (
		<Link
			href="/"
			className="lanna-no-drag -mx-2 -my-1 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-3 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal pointer-coarse:-my-2.5 pointer-coarse:min-h-11"
			data-testid="today-link"
		>
			<Icon className="size-3.5" strokeWidth={1.6} />
			<CapLabel>Today</CapLabel>
		</Link>
	);
}
