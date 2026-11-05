"use client";

/**
 * What Today, the curriculum and a lesson show when the running language has
 * no course yet (src/server/language.ts missingCourse): finish it, or switch
 * to a language that has one.
 */

import { useState } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { SidebarToggle } from "@/components/sidebar";
import { useLanguageActions, type ProfileInfo } from "@/components/language-actions";
import { cn } from "@/lib/utils";

export function NoCourse({ language, initialProfile }: { language: { id: string; english: string }; initialProfile: ProfileInfo }) {
	const [profile, setProfile] = useState<ProfileInfo>(initialProfile);
	const languages = useLanguageActions({
		profile,
		onChanged: (next) => {
			if (next) return setProfile(next);
			void fetch("/api/profile")
				.then((r) => (r.ok ? (r.json() as Promise<ProfileInfo>) : null))
				.then((p) => p && setProfile(p))
				.catch(() => {});
		},
	});
	const others = profile.profiles.filter((p) => p.id !== language.id && p.ready !== false);

	return (
		<div className="flex h-dvh flex-col" data-testid="no-course">
			<header className="lh-drag lh-wco-gutter flex h-[60px] shrink-0 items-center px-4">
				<SidebarToggle />
			</header>
			<main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pb-16">
				<div className="flex w-full max-w-[520px] flex-col gap-5">
					<CountryFlag lang={language.id} className="h-[28px] w-[42px] rounded-[5px]" />
					<div className="flex flex-col gap-2">
						<h1 className="font-ui text-[26px] font-semibold tracking-[-0.02em] text-foreground">{language.english} has no course yet</h1>
						<p className="font-prose text-[16px] leading-relaxed text-ink-2">
							Its words are here, but the lessons, chapters and goals are not built yet. Finish it and LangHarness writes them in the background while you wait or study another language.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button type="button" onClick={() => languages.openAdd(language.id)} className={PRIMARY} data-testid="no-course-finish">
							Finish {language.english}
						</button>
						{others.map((p) => (
							<button key={p.id} type="button" onClick={() => languages.choose(p.id)} className={cn(SECONDARY, "gap-2")} data-testid={`no-course-switch-${p.id}`}>
								<CountryFlag lang={p.id} />
								Switch to {p.english}
							</button>
						))}
					</div>
					{languages.note && (
						<p className="text-xs text-muted-foreground" role="status">
							{languages.note}
						</p>
					)}
				</div>
			</main>
			{languages.dialogs}
		</div>
	);
}
