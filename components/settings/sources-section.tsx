"use client";

import Link from "next/link";
import { CREDIT_GROUPS, creditsFor } from "@/src/core";
import { SettingsGroup, SettingsRow } from "./controls.tsx";
import { languageCodeOf, useLearnerLanguages } from "./system-voices.tsx";

export function SourcesSection({ onNavigate }: { onNavigate?: () => void }) {
	const languages = useLearnerLanguages();
	const credits = creditsFor(languages.map(languageCodeOf));
	return (
		<>
			{CREDIT_GROUPS.map((group) => {
				const inGroup = credits.filter((c) => c.group === group.id);
				if (inGroup.length === 0) return null;
				return (
					<SettingsGroup key={group.id} label={group.label} testid={`sources-${group.id}`}>
						<ul className="flex flex-col gap-1 rounded-lg bg-well px-4 py-3 max-md:gap-3">
							{inGroup.map((c) => (
								<li key={c.id} className="text-xs leading-relaxed text-muted-foreground" data-testid={`credit-${c.id}`}>
									<a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
										{c.name} ↗
									</a>{" "}
									{c.use}
									{c.license && <span className="ml-1.5 font-mono text-[11px]">{c.license}</span>}
								</li>
							))}
						</ul>
					</SettingsGroup>
				);
			})}
			<SettingsGroup label="Research" testid="sources-research">
				<SettingsRow label="The studies behind each task" hint="What each task is built on, what the studies did not show, and the choices the app made on its own.">
					<Link href="/sources" onClick={onNavigate} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="sources-research-link">
						Open Sources
					</Link>
				</SettingsRow>
				<SettingsRow label="Learning methodologies & mentors" hint="The polyglot frameworks, linguists, and practical mentors that shape the app (Lýdia Machová, Stephen Krashen, Paul Nation).">
					<Link href="/methodologies" onClick={onNavigate} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="sources-methodologies-link">
						Open Methodologies
					</Link>
				</SettingsRow>
			</SettingsGroup>
		</>
	);
}
