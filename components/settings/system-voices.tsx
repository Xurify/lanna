"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";
import { sharedJson } from "@/lib/shared-fetch";
import type { ProfileEntry, ProfileInfo } from "@/components/language-actions";
import { SettingsRow } from "./controls.tsx";

/** Languages Windows has a speech voice for, from Microsoft's "Appendix A: Supported languages and voices"
 *  (support.microsoft.com/topic/4486e345-7730-53da-fcfe-55cc64300f01, read 2026-11-08). */
const WINDOWS_VOICE_LANGUAGES = new Set([
	"ar",
	"bg",
	"ca",
	"zh",
	"hr",
	"cs",
	"da",
	"nl",
	"en",
	"fi",
	"fr",
	"de",
	"el",
	"he",
	"hi",
	"hu",
	"id",
	"it",
	"ja",
	"ko",
	"ms",
	"nb",
	"no",
	"pl",
	"pt",
	"ro",
	"ru",
	"sk",
	"sl",
	"es",
	"sv",
	"ta",
	"th",
	"tr",
	"vi",
]);

/** Opens Settings → Time & language → Speech, where Windows adds voices. */
const WINDOWS_SPEECH_SETTINGS = "ms-settings:speech";

export type SystemVoiceStatus = { kind: "installed"; names: string[] } | { kind: "missing"; windowsHasOne: boolean };

export const languageCodeOf = (l: ProfileEntry) => l.tag.split("-")[0]!.toLowerCase();

export function systemVoiceStatus(
	code: string,
	voices: ReadonlyArray<{ lang: string; name: string }>,
): SystemVoiceStatus {
	const names = voices
		.filter((v) => v.lang.toLowerCase().startsWith(code))
		.map((v) => v.name.replace(/^Microsoft /, "").replace(/ - .*$/, ""));
	if (names.length > 0) return { kind: "installed", names: [...new Set(names)] };
	return { kind: "missing", windowsHasOne: WINDOWS_VOICE_LANGUAGES.has(code) };
}

export function useLearnerLanguages(): ProfileEntry[] {
	const [languages, setLanguages] = useState<ProfileEntry[]>([]);
	useEffect(() => {
		void sharedJson<ProfileInfo>("/api/profile")
			.then((p) => setLanguages(p.profiles))
			.catch(() => setLanguages([]));
	}, []);
	return languages;
}

function useSystemVoices(): SpeechSynthesisVoice[] | null {
	const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
	useEffect(() => {
		if (!("speechSynthesis" in window)) {
			setVoices([]);
			return;
		}
		const read = () => setVoices(window.speechSynthesis.getVoices());
		read();
		window.speechSynthesis.addEventListener("voiceschanged", read);
		return () => window.speechSynthesis.removeEventListener("voiceschanged", read);
	}, []);
	return voices;
}

function useOnWindows(): boolean {
	const [onWindows, setOnWindows] = useState(false);
	useEffect(() => setOnWindows(navigator.userAgent.includes("Windows")), []);
	return onWindows;
}

const linkClass = "text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground";

export function SystemVoicesRow() {
	const languages = useLearnerLanguages();
	const voices = useSystemVoices();
	const onWindows = useOnWindows();
	return (
		<SettingsRow
			label="System voice"
			hint="The voice this device reads with when the app's own voices can't be reached. It works offline. If a voice you added isn't listed, restart the app."
			testid="row-system-voice"
			stack
		>
			{voices && languages.length > 0 && (
				<ul className="flex flex-col gap-1.5" data-testid="system-voices">
					{languages.map((l) => (
						<li
							key={l.id}
							className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm"
							data-testid={`system-voice-${l.id}`}
						>
							<span className="flex shrink-0 items-center gap-2">
								<CountryFlag lang={l.id} />
								<span className="font-ui text-foreground">{l.english}</span>
							</span>
							<SystemVoiceState
								status={systemVoiceStatus(languageCodeOf(l), voices)}
								english={l.english}
								onWindows={onWindows}
							/>
						</li>
					))}
				</ul>
			)}
		</SettingsRow>
	);
}

function SystemVoiceState({
	status,
	english,
	onWindows,
}: {
	status: SystemVoiceStatus;
	english: string;
	onWindows: boolean;
}) {
	if (status.kind === "installed") {
		return (
			<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<CheckIcon className="size-3.5 text-teal" aria-hidden />
				{status.names.join(", ")}
			</span>
		);
	}
	if (!onWindows)
		return (
			<span className="text-xs text-muted-foreground">Not installed. Add one in your system's speech settings.</span>
		);
	if (!status.windowsHasOne)
		return <span className="text-xs text-muted-foreground">Windows has no {english} voice</span>;
	return (
		<a href={WINDOWS_SPEECH_SETTINGS} className={linkClass} data-testid="add-windows-voice">
			Add in Windows settings ↗
		</a>
	);
}
