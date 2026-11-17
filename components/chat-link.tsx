"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import type { ExtraProps } from "streamdown";
import { ArrowUpRightIcon } from "lucide-react";
import { startTutorChat } from "@/components/lesson/tutor";
import { mdComponents } from "@/components/md-blocks";
import { chatLinkTarget, curriculumUnit, tutorUnitPrompt } from "@/src/core";
import { cn } from "@/lib/utils";

const SERVER_ORIGIN = "http://localhost";
const LINK =
	"font-medium text-teal-2 underline decoration-teal-line decoration-[1.5px] underline-offset-4 transition-colors hover:text-teal hover:decoration-teal";

function TutorUnitLink({ unitId, children }: { unitId: string; children: ReactNode }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const open = () => {
		const unit = curriculumUnit(unitId);
		if (!unit || busy) return;
		setBusy(true);
		void startTutorChat(router, {
			title: unit.title,
			prompt: tutorUnitPrompt(unit),
			activity: "tutor",
			unit: unit.id,
		}).catch(() => setBusy(false));
	};
	return (
		<button
			type="button"
			onClick={open}
			disabled={busy}
			data-testid="chat-link"
			className={cn(LINK, "inline cursor-pointer text-left disabled:opacity-60")}
		>
			{children}
		</button>
	);
}

export function ChatLink({
	href,
	children,
	node: _node,
	className: _className,
	...rest
}: ComponentProps<"a"> & ExtraProps) {
	const target =
		href === "streamdown:incomplete-link"
			? ({ kind: "text" } as const)
			: chatLinkTarget(href, typeof window === "undefined" ? SERVER_ORIGIN : window.location.origin);
	switch (target.kind) {
		case "text":
			return <span>{children}</span>;
		case "tutor":
			return <TutorUnitLink unitId={target.unit}>{children}</TutorUnitLink>;
		case "app":
			return (
				<Link href={target.path} data-testid="chat-link" className={LINK}>
					{children}
				</Link>
			);
		case "anchor":
			return (
				<a {...rest} href={target.href} className={LINK}>
					{children}
				</a>
			);
		case "web":
			return (
				<a
					{...rest}
					href={target.href}
					target="_blank"
					rel="noreferrer"
					className={cn(LINK, "inline-flex items-baseline gap-0.5")}
				>
					{children}
					<ArrowUpRightIcon className="size-3.5 self-center" strokeWidth={1.8} aria-hidden="true" />
				</a>
			);
	}
}

export const chatMdComponents = { ...mdComponents, a: ChatLink };
