export type CreditGroup = "words" | "voices" | "speech" | "lookup" | "video" | "search" | "art";

export interface Credit {
	id: string;
	name: string;
	url: string;
	group: CreditGroup;
	use: string;
	license?: string;
	onlyForLanguage?: string;
	fetchedHosts?: string[];
}

export const CREDIT_GROUPS: Array<{ id: CreditGroup; label: string }> = [
	{ id: "words", label: "Words and sentences" },
	{ id: "voices", label: "Voices" },
	{ id: "speech", label: "Speech recognition and pronunciation" },
	{ id: "lookup", label: "Word lookup" },
	{ id: "video", label: "Video" },
	{ id: "search", label: "Web search for the tutor" },
	{ id: "art", label: "Fonts, flags and icons" },
];

export const CREDITS: Credit[] = [
	{
		id: "slovak-wiki",
		name: "slovak.wiki",
		url: "https://www.slovak.wiki",
		group: "words",
		use: "the Slovak dictionary, word forms, curated example sentences and grammar pages",
		onlyForLanguage: "sk",
		fetchedHosts: ["www.slovak.wiki", "slovak.wiki"],
	},
	{
		id: "tatoeba",
		name: "Tatoeba",
		url: "https://tatoeba.org",
		group: "words",
		use: "example sentences with their English translations",
		license: "CC BY 2.0 FR",
		fetchedHosts: ["downloads.tatoeba.org"],
	},
	{
		id: "wiktionary",
		name: "Wiktionary, through kaikki.org",
		url: "https://kaikki.org",
		group: "words",
		use: "words, meanings and forms for languages added in the app",
		license: "CC BY-SA 4.0",
		fetchedHosts: ["kaikki.org", "en.wiktionary.org"],
	},
	{
		id: "frequency-words",
		name: "FrequencyWords (Hermit Dave, from OpenSubtitles 2018)",
		url: "https://github.com/hermitdave/FrequencyWords",
		group: "words",
		use: "how common each word is, for languages added in the app",
		license: "CC BY-SA 4.0",
		fetchedHosts: ["raw.githubusercontent.com"],
	},
	{
		id: "snk",
		name: "Slovak National Corpus, through slovak.wiki",
		url: "https://www.korpus.sk",
		group: "words",
		use: "how common each Slovak word is",
		onlyForLanguage: "sk",
	},
	{
		id: "ud-slovak-snk",
		name: "Universal Dependencies, UD_Slovak-SNK",
		url: "https://universaldependencies.org/treebanks/sk_snk/index.html",
		group: "words",
		use: "Slovak verb forms found in real sentences",
		license: "CC BY-SA 4.0",
		onlyForLanguage: "sk",
	},
	{
		id: "juls",
		name: "Ľ. Štúr Institute of Linguistics dictionaries",
		url: "https://slovnik.juls.savba.sk",
		group: "words",
		use: "checked Slovak noun patterns and perfective verbs",
		onlyForLanguage: "sk",
	},

	{
		id: "slovak-wiki-audio",
		name: "slovak.wiki recordings",
		url: "https://www.slovak.wiki",
		group: "voices",
		use: "recorded Slovak words and example sentences",
		onlyForLanguage: "sk",
	},
	{
		id: "elevenlabs",
		name: "ElevenLabs",
		url: "https://elevenlabs.io/docs/overview/models",
		group: "voices",
		use: "AI voices, with your ElevenLabs key",
		fetchedHosts: ["api.elevenlabs.io", "elevenlabs.io"],
	},
	{
		id: "phonic",
		name: "Phonic",
		url: "https://docs.phonic.ai",
		group: "voices",
		use: "speech-to-speech conversation in live talk, with your Phonic key",
		fetchedHosts: ["phonic.ai", "api.phonic.ai", "docs.phonic.ai"],
	},
	{
		id: "edge-voices",
		name: "Microsoft neural voices",
		url: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts",
		group: "voices",
		use: "the free online voices, read through Edge",
	},
	{
		id: "piper",
		name: "Piper",
		url: "https://github.com/rhasspy/piper",
		group: "voices",
		use: "offline voices, when you set up a Piper model",
	},
	{
		id: "windows-voices",
		name: "Windows voices",
		url: "https://support.microsoft.com/en-us/topic/4486e345-7730-53da-fcfe-55cc64300f01",
		group: "voices",
		use: "the system voices Windows can add, by language",
	},

	{
		id: "elevenlabs-scribe",
		name: "ElevenLabs Scribe",
		url: "https://elevenlabs.io/speech-to-text",
		group: "speech",
		use: "what you say in Speak, with your ElevenLabs key",
	},
	{
		id: "groq-whisper",
		name: "Whisper on Groq",
		url: "https://console.groq.com/docs/speech-to-text",
		group: "speech",
		use: "what you say in Speak, with your Groq key",
		fetchedHosts: ["api.groq.com"],
	},
	{
		id: "deepgram",
		name: "Deepgram",
		url: "https://deepgram.com",
		group: "speech",
		use: "dictation, what you say in Speak, and videos with no captions, with your Deepgram key",
		fetchedHosts: ["api.deepgram.com", "console.deepgram.com"],
	},
	{
		id: "azure-pronunciation",
		name: "Azure Speech pronunciation assessment",
		url: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment",
		group: "speech",
		use: "sound-by-sound scores in Speak and Speed, with your Azure Speech key",
		fetchedHosts: ["learn.microsoft.com", "portal.azure.com"],
	},

	{
		id: "deepl",
		name: "DeepL",
		url: "https://www.deepl.com",
		group: "lookup",
		use: "word and phrase meanings in the Hybrid and Translator lookup modes, with your DeepL key",
		fetchedHosts: ["api-free.deepl.com", "api.deepl.com", "www.deepl.com"],
	},
	{
		id: "google-translate",
		name: "Google Translate",
		url: "https://translate.google.com",
		group: "lookup",
		use: "word meanings in the Hybrid and Translator lookup modes when no DeepL key is set",
		fetchedHosts: ["translate.googleapis.com", "clients5.google.com"],
	},
	{
		id: "mymemory",
		name: "MyMemory",
		url: "https://mymemory.translated.net",
		group: "lookup",
		use: "word meanings when Google Translate can't be reached",
		fetchedHosts: ["api.mymemory.translated.net"],
	},

	{
		id: "youtube",
		name: "YouTube",
		url: "https://www.youtube.com",
		group: "video",
		use: "videos, their captions and the player in Watch; a video's title and thumbnail in Notes",
		fetchedHosts: ["www.youtube.com", "i.ytimg.com"],
	},
	{
		id: "yt-dlp",
		name: "yt-dlp",
		url: "https://github.com/yt-dlp/yt-dlp",
		group: "video",
		use: "captions and audio when YouTube's own can't be read, if installed",
	},
	{
		id: "spotify",
		name: "Spotify",
		url: "https://open.spotify.com",
		group: "video",
		use: "a track's title, cover and audio in Watch, when you paste a Spotify track link",
		fetchedHosts: ["open.spotify.com"],
	},
	{
		id: "spotdl",
		name: "spotdl",
		url: "https://github.com/spotDL/spotify-downloader",
		group: "video",
		use: "downloads a Spotify track's audio for Watch, if installed (Python)",
	},

	{
		id: "context",
		name: "Context",
		url: "https://context.dev",
		group: "search",
		use: "web search, with your Context key",
		fetchedHosts: ["api.context.dev", "context.dev"],
	},
	{
		id: "tavily",
		name: "Tavily",
		url: "https://tavily.com",
		group: "search",
		use: "web search, with your Tavily key",
		fetchedHosts: ["api.tavily.com", "app.tavily.com"],
	},
	{
		id: "brave-search",
		name: "Brave Search",
		url: "https://brave.com/search/api/",
		group: "search",
		use: "web search, with your Brave key",
		fetchedHosts: ["api.search.brave.com", "brave.com"],
	},
	{
		id: "jina-reader",
		name: "Jina Reader",
		url: "https://jina.ai/reader/",
		group: "search",
		use: "reading a web page the tutor opens",
		fetchedHosts: ["r.jina.ai"],
	},

	{ id: "geist", name: "Geist", url: "https://vercel.com/font", group: "art", use: "the interface font" },
	{
		id: "source-serif",
		name: "Source Serif 4",
		url: "https://github.com/adobe-fonts/source-serif",
		group: "art",
		use: "the reading font",
	},
	{
		id: "jetbrains-mono",
		name: "JetBrains Mono",
		url: "https://www.jetbrains.com/lp/mono/",
		group: "art",
		use: "the code font",
	},
	{
		id: "country-flag-icons",
		name: "country-flag-icons",
		url: "https://github.com/catamphetamine/country-flag-icons",
		group: "art",
		use: "the flags",
		license: "MIT",
	},
	{ id: "lucide", name: "Lucide", url: "https://lucide.dev", group: "art", use: "the icons" },
	{
		id: "svgl",
		name: "SVGL",
		url: "https://svgl.app",
		group: "art",
		use: "the logos of AI providers and services",
		fetchedHosts: ["svgl.app"],
	},
];

export const HOSTS_THAT_ARE_NOT_SOURCES = new Set([
	"api.openai.com",
	"chatgpt.com",
	"auth.openai.com",
	"api.x.ai",
	"api.individual.githubcopilot.com",
	"doi.org",
	"www.w3.org",
	"forum.clozemaster.com",
]);

export function creditsFor(codes: readonly string[]): Credit[] {
	return CREDITS.filter((c) => !c.onlyForLanguage || codes.includes(c.onlyForLanguage));
}
