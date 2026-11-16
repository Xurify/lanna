"use client";

/**
 * The line that says a feature is better with AI and how to turn it on
 * (LangHarness, 2026-11-01). Shown only while AI is not ready: no model on
 * set up, or its provider has no key. It says what
 * is missing in plain words, what AI adds, and that the rest works without
 * it, then opens Settings in place (SettingsLink).
 */

import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { SettingsLink } from "@/components/settings/settings-link";
import { AUTH_PROVIDER_KEYS, type AiStatus } from "@/src/core";

export function AiCallout({
	status,
	title,
	adds,
	className,
}: {
	status: AiStatus;
	title: string;
	adds: string[];
	className?: string;
}) {
	if (status.ready) return null;
	const provider = AUTH_PROVIDER_KEYS.find((p) => p.id === status.provider)?.label ?? status.provider;
	const missing = status.reason === "no-model" ? "AI is not set up yet." : `The ${provider} key is missing.`;
	return (
		<div className={cn("q-well", className)} data-testid="ai-callout">
			<p className="flex items-center gap-1.5 font-ui text-sm font-semibold text-foreground">
				<SparklesIcon className="size-4 text-teal" aria-hidden="true" />
				{title}
			</p>
			{adds.length > 0 && (
				<ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-prose text-sm text-foreground marker:text-muted-foreground">
					{adds.map((a) => (
						<li key={a}>{a}</li>
					))}
				</ul>
			)}
			<p className="mt-2 font-prose text-xs text-muted-foreground">{missing} Everything else here works without AI.</p>
			<SettingsLink keys={status.reason === "no-key"} className={cn(SECONDARY, SMALL, "mt-3 pointer-coarse:min-h-11")}>
				{status.reason === "no-model" ? "Set up AI" : `Add the ${provider} key`}
			</SettingsLink>
		</div>
	);
}
