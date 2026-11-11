import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Maps a language identifier, profile id, or BCP-47 tag to an ISO 3166-1 alpha-2 country code.
 */
export function langToCountryCode(lang?: string): string {
	if (!lang) return "UN";
	const l = lang.toLowerCase().trim();
	switch (l) {
		case "slovak":
		case "sk":
		case "sk-sk":
			return "SK";
		case "russian":
		case "ru":
		case "ru-ru":
			return "RU";
		case "english":
		case "en":
		case "en-us":
		case "en-gb":
			return "GB";
		case "german":
		case "de":
		case "de-de":
			return "DE";
		case "french":
		case "fr":
		case "fr-fr":
			return "FR";
		case "spanish":
		case "es":
		case "es-es":
			return "ES";
		case "italian":
		case "it":
		case "it-it":
			return "IT";
		case "portuguese":
		case "pt":
		case "pt-pt":
		case "pt-br":
			return "PT";
		case "czech":
		case "cs":
		case "cz":
			return "CZ";
		case "polish":
		case "pl":
			return "PL";
		case "ukrainian":
		case "uk":
		case "ua":
			return "UA";
		case "estonian":
		case "et":
		case "ee":
			return "EE";
		case "finnish":
		case "fi":
			return "FI";
		case "swedish":
		case "sv":
		case "se":
			return "SE";
		case "dutch":
		case "nl":
			return "NL";
		case "hungarian":
		case "hu":
			return "HU";
		case "slovene":
		case "sl":
		case "si":
			return "SI";
		case "croatian":
		case "hr":
			return "HR";
		case "bulgarian":
		case "bg":
			return "BG";
		case "latvian":
		case "lv":
			return "LV";
		case "lithuanian":
		case "lt":
			return "LT";
		case "romanian":
		case "ro":
			return "RO";
		case "greek":
		case "el":
		case "gr":
			return "GR";
		case "turkish":
		case "tr":
			return "TR";
		case "norwegian":
		case "no":
			return "NO";
		case "danish":
		case "da":
		case "dk":
			return "DK";
		case "icelandic":
		case "is":
			return "IS";
		case "irish":
		case "ga":
		case "ie":
			return "IE";
		case "welsh":
		case "cy":
			return "GB";
		case "basque":
		case "eu":
			return "ES";
		case "catalan":
		case "ca":
			return "ES";
		case "galician":
		case "gl":
			return "ES";
		case "serbian":
		case "sr":
		case "rs":
			return "RS";
		case "macedonian":
		case "mk":
			return "MK";
		case "belarusian":
		case "be":
		case "by":
			return "BY";
		case "albanian":
		case "sq":
		case "al":
			return "AL";
		case "maltese":
		case "mt":
			return "MT";
		case "arabic":
		case "ar":
		case "sa":
			return "SA";
		case "hebrew":
		case "he":
		case "il":
			return "IL";
		case "persian":
		case "fa":
		case "ir":
			return "IR";
		case "hindi":
		case "hi":
		case "in":
			return "IN";
		case "urdu":
		case "ur":
		case "pk":
			return "PK";
		case "bengali":
		case "bn":
		case "bd":
			return "BD";
		case "punjabi":
		case "pa":
			return "IN";
		case "tamil":
		case "ta":
			return "IN";
		case "telugu":
		case "te":
			return "IN";
		case "malayalam":
		case "ml":
			return "IN";
		case "japanese":
		case "ja":
		case "jp":
			return "JP";
		case "korean":
		case "ko":
		case "kr":
			return "KR";
		case "chinese":
		case "zh":
		case "cn":
			return "CN";
		case "vietnamese":
		case "vi":
		case "vn":
			return "VN";
		case "thai":
		case "th":
			return "TH";
		case "indonesian":
		case "id":
			return "ID";
		case "malay":
		case "ms":
		case "my":
			return "MY";
		case "filipino":
		case "tl":
		case "ph":
			return "PH";
		case "swahili":
		case "sw":
		case "ke":
			return "KE";
		case "amharic":
		case "am":
			return "ET";
		case "georgian":
		case "ka":
		case "ge":
			return "GE";
		case "armenian":
		case "hy":
			return "AM";
		case "azerbaijani":
		case "az":
			return "AZ";
		case "kazakh":
		case "kk":
		case "kz":
			return "KZ";
		case "uzbek":
		case "uz":
			return "UZ";
		case "mongolian":
		case "mn":
			return "MN";
		default:
			return l.length === 2 ? l.toUpperCase() : "UN";
	}
}

interface CountryFlagProps {
	/** Language ID (e.g. "slovak", "russian", "sk", "ru", "en"). */
	lang?: string;
	/** Direct 2-letter country code (e.g. "SK", "RU", "GB"). Takes precedence over `lang`. */
	code?: string;
	/** Optional class string for sizing and layout. */
	className?: string;
	/** Title/tooltip for accessibility. */
	title?: string;
}

type FlagComponent = React.ComponentType<{ className?: string; title?: string; preserveAspectRatio?: string }>;

/** The flag set (about 250 flags, 350 kB of script) loads on first use instead of riding in every
 *  page's bundle. Until it arrives the box is empty and the same size, so nothing moves. */
let flags: Record<string, FlagComponent> | null = null;
let loading: Promise<void> | null = null;

export function loadFlags(): Promise<void> {
	loading ??= import("country-flag-icons/react/3x2").then((m) => {
		flags = m as unknown as Record<string, FlagComponent>;
	});
	return loading;
}

export function CountryFlag({ lang, code, className, title }: CountryFlagProps) {
	const c = (code ?? langToCountryCode(lang)).toUpperCase();
	const [ready, setReady] = useState(flags !== null);
	useEffect(() => {
		if (!flags) void loadFlags().then(() => setReady(true));
	}, []);
	const Flag = ready ? flags?.[c] : undefined;

	return (
		<span
			role="img"
			aria-label={title ?? `${c} flag`}
			title={title ?? `${c} flag`}
			data-country-code={c}
			className={cn(
				"relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[3px] select-none bg-well w-6 h-4",
				className,
			)}
		>
			{Flag ? (
				<Flag className="block h-full w-full" preserveAspectRatio="xMidYMid slice" />
			) : ready ? (
				<span className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground select-none">
					{c}
				</span>
			) : null}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-[rgb(var(--q-shadow-rgb)/0.14)] dark:ring-white/[0.12]"
			/>
		</span>
	);
}
