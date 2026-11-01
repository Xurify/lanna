import React from "react";
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
		case "georgian":
		case "ka":
		case "ge":
			return "GE";
		case "armenian":
		case "hy":
		case "am":
			return "AM";
		case "azerbaijani":
		case "az":
			return "AZ";
		case "kazakh":
		case "kk":
		case "kz":
			return "KZ";
		default:
			return l.length === 2 ? l.toUpperCase() : "UN";
	}
}

function FlagSvg({ code }: { code: string }) {
	switch (code) {
		case "SK":
			return (
				<svg viewBox="0 0 640 480" className="block h-full w-full" aria-hidden="true">
					<path fill="#ee1c25" d="M0 0h640v480H0z" />
					<path fill="#0b4ea2" d="M0 0h640v320H0z" />
					<path fill="#ffffff" d="M0 0h640v160H0z" />
					<path
						fill="#ffffff"
						d="M233 370.8c-43-20.7-104.6-61.9-104.6-143.2 0-81.4 4-118.4 4-118.4h201.3s3.9 37 3.9 118.4S276 350 233 370.8"
					/>
					<path
						fill="#ee1c25"
						d="M233 360c-39.5-19-96-56.8-96-131.4s3.6-108.6 3.6-108.6h184.8s3.5 34 3.5 108.6C329 303.3 272.5 341 233 360"
					/>
					<path
						fill="#ffffff"
						d="M241.4 209c10.7.2 31.6.6 50.1-5.6 0 0-.4 6.7-.4 14.4s.5 14.4.5 14.4c-17-5.7-38.1-5.8-50.2-5.7v41.2h-16.8v-41.2c-12-.1-33.1 0-50.1 5.7 0 0 .5-6.7.5-14.4s-.5-14.4-.5-14.4c18.5 6.2 39.4 5.8 50 5.6v-25.9c-9.7 0-23.7.4-39.6 5.7 0 0 .5-6.6.5-14.4 0-7.7-.5-14.4-.5-14.4 15.9 5.3 29.9 5.8 39.6 5.7-.5-16.4-5.3-37-5.3-37s9.9.7 13.8.7 13.8-.7 13.8-.7-4.8 20.6-5.3 37c9.7.1 23.7-.4 39.6-5.7 0 0-.5 6.7-.5 14.4s.5 14.4.5 14.4a119 119 0 0 0-39.7-5.7v26z"
					/>
					<path
						fill="#0b4ea2"
						d="M233 263.3c-19.9 0-30.5 27.5-30.5 27.5s-6-13-22.2-13c-11 0-19 9.7-24.2 18.8 20 31.7 51.9 51.3 76.9 63.4 25-12 57-31.7 76.9-63.4-5.2-9-13.2-18.8-24.2-18.8-16.2 0-22.2 13-22.2 13S253 263.3 233 263.3"
					/>
				</svg>
			);
		case "RU":
			return (
				<svg viewBox="0 0 640 480" className="block h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v160H0z" />
					<path fill="#0039a6" d="M0 160h640v160H0z" />
					<path fill="#d52b1e" d="M0 320h640v160H0z" />
				</svg>
			);
		case "CZ":
			return (
				<svg viewBox="0 0 640 480" className="block h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v240H0z" />
					<path fill="#d7141a" d="M0 240h640v240H0z" />
					<path fill="#11457e" d="M360 240 0 0v480z" />
				</svg>
			);
		case "DE":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#000000" d="M0 0h640v160H0z" />
					<path fill="#dd0000" d="M0 160h640v160H0z" />
					<path fill="#ffce00" d="M0 320h640v160H0z" />
				</svg>
			);
		case "UA":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#005bbb" d="M0 0h640v240H0z" />
					<path fill="#ffd500" d="M0 240h640v240H0z" />
				</svg>
			);
		case "PL":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v240H0z" />
					<path fill="#dc143c" d="M0 240h640v240H0z" />
				</svg>
			);
		case "GB":
			return (
				<svg viewBox="0 0 640 480" className="block h-full w-full" aria-hidden="true">
					<path fill="#012169" d="M0 0h640v480H0z" />
					<path fill="#ffffff" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z" />
					<path fill="#c8102e" d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z" />
					<path fill="#ffffff" d="M241 0v480h160V0zM0 160v160h640V160z" />
					<path fill="#c8102e" d="M0 193v96h640v-96zM273 0v480h96V0z" />
				</svg>
			);
		case "FR":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#002654" d="M0 0h213.3v480H0z" />
					<path fill="#ffffff" d="M213.3 0h213.4v480H213.3z" />
					<path fill="#ce1126" d="M426.7 0h213.3v480H426.7z" />
				</svg>
			);
		case "ES":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#aa151b" d="M0 0h640v120H0zM0 360h640v120H0z" />
					<path fill="#f1bf00" d="M0 120h640v240H0z" />
				</svg>
			);
		case "IT":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#009246" d="M0 0h213.3v480H0z" />
					<path fill="#ffffff" d="M213.3 0h213.4v480H213.3z" />
					<path fill="#ce2b37" d="M426.7 0h213.3v480H426.7z" />
				</svg>
			);
		case "EE":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#0072ce" d="M0 0h640v160H0z" />
					<path fill="#000000" d="M0 160h640v160H0z" />
					<path fill="#ffffff" d="M0 320h640v160H0z" />
				</svg>
			);
		case "FI":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v480H0z" />
					<path d="M220 0v480M0 240h640" stroke="#003580" strokeWidth="100" />
				</svg>
			);
		case "SE":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#006aa7" d="M0 0h640v480H0z" />
					<path d="M200 0v480M0 240h640" stroke="#fecc00" strokeWidth="80" />
				</svg>
			);
		case "NL":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ae1c28" d="M0 0h640v160H0z" />
					<path fill="#ffffff" d="M0 160h640v160H0z" />
					<path fill="#21468b" d="M0 320h640v160H0z" />
				</svg>
			);
		case "HU":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ce2939" d="M0 0h640v160H0z" />
					<path fill="#ffffff" d="M0 160h640v160H0z" />
					<path fill="#477050" d="M0 320h640v160H0z" />
				</svg>
			);
		case "RO":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#002b7f" d="M0 0h213.3v480H0z" />
					<path fill="#fcd116" d="M213.3 0h213.4v480H213.3z" />
					<path fill="#ce1126" d="M426.7 0h213.3v480H426.7z" />
				</svg>
			);
		case "BG":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v160H0z" />
					<path fill="#00966e" d="M0 160h640v160H0z" />
					<path fill="#d62612" d="M0 320h640v160H0z" />
				</svg>
			);
		case "HR":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ff0000" d="M0 0h640v160H0z" />
					<path fill="#ffffff" d="M0 160h640v160H0z" />
					<path fill="#171796" d="M0 320h640v160H0z" />
				</svg>
			);
		case "SI":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v160H0z" />
					<path fill="#005ce6" d="M0 160h640v160H0z" />
					<path fill="#ed1c24" d="M0 320h640v160H0z" />
				</svg>
			);
		case "LV":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#9e3039" d="M0 0h640v192H0zM0 288h640v192H0z" />
					<path fill="#ffffff" d="M0 192h640v96H0z" />
				</svg>
			);
		case "LT":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#fdb913" d="M0 0h640v160H0z" />
					<path fill="#006a44" d="M0 160h640v160H0z" />
					<path fill="#c1272d" d="M0 320h640v160H0z" />
				</svg>
			);
		case "PT":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#046a38" d="M0 0h256v480H0z" />
					<path fill="#da291c" d="M256 0h384v480H256z" />
					<circle cx="256" cy="240" r="70" fill="#ffcd00" />
				</svg>
			);
		case "GR":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#0d5eaf" d="M0 0h640v480H0z" />
					<path fill="#ffffff" d="M0 53.3h640v53.3H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0zm0 106.7h640v53.3H0z" />
					<path fill="#0d5eaf" d="M0 0h240v266.7H0z" />
					<path d="M120 0v266.7M0 133.3h240" stroke="#ffffff" strokeWidth="48" />
				</svg>
			);
		case "TR":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#e30a17" d="M0 0h640v480H0z" />
					<circle cx="280" cy="240" r="120" fill="#ffffff" />
					<circle cx="310" cy="240" r="96" fill="#e30a17" />
				</svg>
			);
		case "JP":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ffffff" d="M0 0h640v480H0z" />
					<circle cx="320" cy="240" r="144" fill="#bc002d" />
				</svg>
			);
		case "CN":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#de2910" d="M0 0h640v480H0z" />
					<circle cx="106" cy="120" r="30" fill="#ffde00" />
				</svg>
			);
		case "IE":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#169b62" d="M0 0h213.3v480H0z" />
					<path fill="#ffffff" d="M213.3 0h213.4v480H213.3z" />
					<path fill="#ff883e" d="M426.7 0h213.3v480H426.7z" />
				</svg>
			);
		case "AT":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ed2939" d="M0 0h640v160H0zM0 320h640v160H0z" />
					<path fill="#ffffff" d="M0 160h640v160H0z" />
				</svg>
			);
		case "NO":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#ba0c2f" d="M0 0h640v480H0z" />
					<path d="M200 0v480M0 240h640" stroke="#ffffff" strokeWidth="80" />
					<path d="M200 0v480M0 240h640" stroke="#00205b" strokeWidth="40" />
				</svg>
			);
		case "DK":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#c60c30" d="M0 0h640v480H0z" />
					<path d="M210 0v480M0 240h640" stroke="#ffffff" strokeWidth="60" />
				</svg>
			);
		case "IS":
			return (
				<svg viewBox="0 0 640 480" className="h-full w-full" aria-hidden="true">
					<path fill="#02529c" d="M0 0h640v480H0z" />
					<path d="M200 0v480M0 240h640" stroke="#ffffff" strokeWidth="80" />
					<path d="M200 0v480M0 240h640" stroke="#dc1e35" strokeWidth="40" />
				</svg>
			);
		default:
			return (
				<span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground select-none">
					{code}
				</span>
			);
	}
}

export interface CountryFlagProps {
	/** Language ID (e.g. "slovak", "russian", "sk", "ru", "en"). */
	lang?: string;
	/** Direct 2-letter country code (e.g. "SK", "RU", "GB"). Takes precedence over `lang`. */
	code?: string;
	/** Optional class string for sizing and layout. */
	className?: string;
	/** Title/tooltip for accessibility. */
	title?: string;
}

export function CountryFlag({ lang, code, className, title }: CountryFlagProps) {
	const c = (code ?? langToCountryCode(lang)).toUpperCase();
	return (
		<span
			role="img"
			aria-label={title ?? `${c} flag`}
			title={title ?? `${c} flag`}
			data-country-code={c}
			className={cn(
				"relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-[2px] shadow-2xs ring-1 ring-black/15 dark:ring-white/20 select-none bg-muted/40 w-5 h-[15px]",
				className,
			)}
		>
			<FlagSvg code={c} />
		</span>
	);
}
