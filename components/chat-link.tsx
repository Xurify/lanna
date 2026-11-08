"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps, type ReactNode } from "react";
import type { ExtraProps } from "streamdown";
import { ArrowUpRightIcon } from "lucide-react";
import { startTutorChat } from "@/components/lesson/tutor";
import { mdComponents } from "@/components/md-blocks";
import { curriculumUnit, tutorUnitAt, tutorUnitPrompt } from "@/src/core";
import { cn } from "@/lib/utils";

const LINK = "font-medium text-teal-2 underline decoration-teal-line decoration-[1.5px] underline-offset-4 transition-colors hover:text-teal hover:decoration-teal";

function TutorUnitLink({ unitId, children }: { unitId: string; children: ReactNode }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const open = () => {
		const unit = curriculumUnit(unitId);
		if (!unit || busy) return;
		setBusy(true);
		void startTutorChat(router, { title: `Tutor: ${unit.title}`, prompt: tutorUnitPrompt(unit), activity: "tutor", unit: unit.id }).catch(() => setBusy(false));
	};
	return (
		<button type="button" onClick={open} disabled={busy} data-testid="chat-link" className={cn(LINK, "cursor-pointer text-left disabled:opacity-60")}>
			{children}
		</button>
	);
}

/** A link in a tutor's reply: the app's own pages open in place, anything else in a new window. */
export function ChatLink({ href, children, node: _node, className: _className, ...rest }: ComponentProps<"a"> & ExtraProps) {
	if (!href || href === "streamdown:incomplete-link") return <span>{children}</span>;
	if (href.startsWith("/") && !href.startsWith("//")) {
		const tutor = tutorUnitAt(href);
		if (tutor) return <TutorUnitLink unitId={tutor}>{children}</TutorUnitLink>;
		return (
			<Link href={href} data-testid="chat-link" className={LINK}>
				{children}
			</Link>
		);
	}
	return (
		<a {...rest} href={href} target="_blank" rel="noreferrer" className={cn(LINK, "inline-flex items-baseline gap-0.5")}>
			{children}
			<ArrowUpRightIcon className="size-3.5 self-center" strokeWidth={1.8} aria-hidden="true" />
		</a>
	);
}

/** The tutor chat's Markdown: the shared blocks, with the app's own links opening in place. */
export const chatMdComponents = { ...mdComponents, a: ChatLink };
