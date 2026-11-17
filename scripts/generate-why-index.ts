/**
 * Pre-indexes accurate "Why?" explanations for Slovak grammar and vocabulary slips.
 * Populates data/profiles/slovak/lessons/why-index.json and corresponding practice
 * chats in data/profiles/slovak/chats/ ahead of time, eliminating runtime token usage.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PATHS } from "../config.ts";

export interface WhySeed {
	sentence: string;
	answer: string;
	lemma: string;
	commonGiven: string;
	title: string;
	topic: string;
	explanation: string;
}

export const WHY_SEEDS: WhySeed[] = [
	// 1. Locative Case
	{
		sentence: "Bývam v dome.",
		answer: "dome",
		lemma: "dom",
		commonGiven: "dom",
		title: "Why dome?",
		topic: "Locative Case: Masculine Inanimate Nouns",
		explanation:
			"In Slovak, when the preposition **v** (in) or **na** (on) indicates a static location (answering *Kde?* — Where?), it governs the **locative case**.\n\nFor regular masculine inanimate nouns like **dom** (house), the locative singular ending is **-e**: *v dome* (in the house).\n\n*Dom* is the nominative/accusative dictionary form. Using *v dom* is incorrect because prepositions of location require the case ending that reflects position inside.",
	},
	{
		sentence: "Som v meste.",
		answer: "meste",
		lemma: "mesto",
		commonGiven: "mesto",
		title: "Why meste?",
		topic: "Locative Case: Neuter Nouns in -o",
		explanation:
			"The preposition **v** (in) expressing stationary location requires the **locative case**.\n\nNeuter nouns ending in **-o** (such as **mesto** — city, town) take the ending **-e** in the locative singular:\n• *mesto* (city) → *v meste* (in the city).\n\nLeaving it as *v mesto* would either be grammatically uninflected or mistakenly imply directional movement into the city.",
	},
	{
		sentence: "Káva je na stole.",
		answer: "stole",
		lemma: "stôl",
		commonGiven: "stôl",
		title: "Why stole?",
		topic: "Locative Case: Vowel Alternation (ô -> o)",
		explanation:
			"The preposition **na** (on) indicating location on a surface governs the **locative case**.\n\nIn Slovak, the noun **stôl** (table) has a rhythmic vowel alternation: the diphthong **ô** shortens to **o** when case endings are added:\n• Nominative: *stôl*\n• Locative: *na stole* (on the table).\n\nTherefore, the correct form on the table is *na stole*, with ending **-e** and base vowel **o**.",
	},
	{
		sentence: "Pracujem v škole.",
		answer: "škole",
		lemma: "škola",
		commonGiven: "škola",
		title: "Why škole?",
		topic: "Locative Case: Feminine Nouns in -a",
		explanation:
			"The preposition **v** requires the **locative case** for static location.\n\nFeminine nouns ending in **-a** (pattern *žena*, like **škola** — school) take the ending **-e** in the locative singular:\n• *škola* → *v škole* (in the school / at school).\n\nForm *škola* is nominative, and *školy* is genitive singular or nominative plural.",
	},
	{
		sentence: "Stretneme sa na stanici.",
		answer: "stanici",
		lemma: "stanica",
		commonGiven: "stanica",
		title: "Why stanici?",
		topic: "Locative Case: Feminine Nouns in -ica",
		explanation:
			"Feminine nouns ending in **-ica** (like **stanica** — station, **ulica** — street) belong to the soft feminine pattern *ulica*.\n\nIn the locative singular after **na** or **v**, these soft feminine nouns take the ending **-i** (not -e):\n• *stanica* → *na stanici* (at the station)\n• *ulica* → *na ulici* (on the street).\n\n*Stanici* is the correct locative form.",
	},
	{
		sentence: "Sedím pri okne.",
		answer: "okne",
		lemma: "okno",
		commonGiven: "okno",
		title: "Why okne?",
		topic: "Locative Case: Preposition 'pri'",
		explanation:
			"The preposition **pri** (near, beside, by) always governs the **locative case**.\n\nFor the neuter noun **okno** (window), the locative singular ending is **-e**:\n• *okno* → *pri okne* (by the window).\n\nUsing *pri okno* (nominative) or *pri oknu* (dative) does not match the preposition's locative requirement.",
	},

	// 2. Accusative Case (Direct Object)
	{
		sentence: "Vidím brata.",
		answer: "brata",
		lemma: "brat",
		commonGiven: "brat",
		title: "Why brata?",
		topic: "Accusative Case: Masculine Animate Nouns",
		explanation:
			"In Slovak grammar, masculine nouns distinguish between **animate** (persons and animals) and **inanimate** (objects and concepts).\n\nFor masculine **animate** nouns like **brat** (brother), the accusative singular (direct object of *vidieť*) is identical to the genitive and takes the ending **-a**:\n• Nominative: *brat* (subject: Brat spí = The brother sleeps)\n• Accusative: *brata* (object: Vidím brata = I see my brother).\n\n*Vidím brat* is incorrect because inanimate objects keep their nominative form, but human/animate beings must take **-a**.",
	},
	{
		sentence: "Poznám nového priateľa.",
		answer: "priateľa",
		lemma: "priateľ",
		commonGiven: "priateľ",
		title: "Why priateľa?",
		topic: "Accusative Case: Soft Masculine Animate Nouns",
		explanation:
			"**Priateľ** (friend) is a masculine animate noun. When it is the direct object of *poznať* (to know a person), it must be in the **accusative case**.\n\nBecause it is animate, its accusative takes the ending **-a** (soft stem: **-ľa**):\n• *Poznám nového priateľa.* (I know a new friend).\n\nNotice also that the preceding adjective matches in masculine animate accusative: *nového*.",
	},
	{
		sentence: "Čítam zaujímavú knihu.",
		answer: "knihu",
		lemma: "kniha",
		commonGiven: "kniha",
		title: "Why knihu?",
		topic: "Accusative Case: Feminine Nouns in -a",
		explanation:
			"When a feminine noun ending in **-a** (like **kniha** — book) is the direct object of a verb (*čítať* — to read), it takes the **accusative singular** ending **-u**:\n• Nominative: *kniha* (subject: Kniha je zaujímavá)\n• Accusative: *knihu* (direct object: Čítam knihu).\n\nThe adjective also agrees in the accusative feminine: *zaujímavú knihu*.",
	},
	{
		sentence: "Poprosím jednu kávu.",
		answer: "kávu",
		lemma: "káva",
		commonGiven: "káva",
		title: "Why kávu?",
		topic: "Accusative Case: Ordering & Direct Objects",
		explanation:
			"When ordering food or drinks with verbs like *poprosiť* (to ask for) or *dať si* (to have), the item requested is the direct object in the **accusative case**.\n\n**Káva** is a feminine noun ending in **-a**, so its accusative singular is **kávu**:\n• *Poprosím jednu kávu.* (One coffee, please).\n\n*Káva* is nominative; *kávu* is the correct object form.",
	},
	{
		sentence: "Mám nový bicykel.",
		answer: "bicykel",
		lemma: "bicykel",
		commonGiven: "bicykla",
		title: "Why bicykel?",
		topic: "Accusative Case: Masculine Inanimate Nouns",
		explanation:
			"In Slovak, masculine **inanimate** nouns (non-living things, vehicles, objects) have their accusative singular identical to the nominative singular:\n• Nominative: *nový bicykel*\n• Accusative: *Mám nový bicykel* (not *bicykla*).\n\nThe ending *-a* (*bicykla*) is only genitive, or used for masculine *animate* beings (like *brata*). For inanimate tools and vehicles, use the base form *bicykel*.",
	},

	// 3. Genitive Case
	{
		sentence: "Cestujem do Popradu.",
		answer: "Popradu",
		lemma: "Poprad",
		commonGiven: "Poprad",
		title: "Why Popradu?",
		topic: "Genitive Case: Preposition 'do'",
		explanation:
			"The preposition **do** (to / into) always requires the **genitive case** to express destination or motion into a place.\n\nFor most masculine inanimate town and city names (like **Poprad**), the genitive singular ending is **-u**:\n• *do Popradu* (to Poprad)\n• *do Ružomberka* / *do Zvolena*.\n\n*Do Poprad* lacks case inflection; *do Poprade* incorrectly uses the locative.",
	},
	{
		sentence: "Idem do školy.",
		answer: "školy",
		lemma: "škola",
		commonGiven: "škole",
		title: "Why školy?",
		topic: "Genitive Case: Destination with 'do'",
		explanation:
			"The preposition **do** expresses motion toward or into and strictly takes the **genitive case**.\n\nFor feminine nouns ending in **-a** (like **škola**), the genitive singular ending is **-y**:\n• *do školy* (to school).\n\n*V škole* (with -e) is locative for being already inside (*Kde?*), whereas *do školy* (with -y) is genitive for direction (*Kam?*).",
	},
	{
		sentence: "Pijem kávu bez cukru.",
		answer: "cukru",
		lemma: "cukor",
		commonGiven: "cukor",
		title: "Why cukru?",
		topic: "Genitive Case: Preposition 'bez'",
		explanation:
			"The preposition **bez** (without) always governs the **genitive case**.\n\nFor the masculine noun **cukor** (sugar), the fleeting vowel *o* drops out and the genitive ending is **-u**:\n• Nominative: *cukor*\n• Genitive: *bez cukru* (without sugar).\n\nLeaving it as *bez cukor* ignores prepositional case government.",
	},
	{
		sentence: "Pijem kávu bez mlieka.",
		answer: "mlieka",
		lemma: "mlieko",
		commonGiven: "mlieko",
		title: "Why mlieka?",
		topic: "Genitive Case: Neuter Nouns after 'bez'",
		explanation:
			"The preposition **bez** requires the **genitive case**.\n\nNeuter nouns ending in **-o** (such as **mlieko** — milk) take the ending **-a** in the genitive singular:\n• *mlieko* → *bez mlieka* (without milk).\n\n*Mlieko* is the nominative form; *mlieka* is genitive.",
	},

	// 4. Instrumental Case
	{
		sentence: "Idem s priateľom.",
		answer: "priateľom",
		lemma: "priateľ",
		commonGiven: "priateľ",
		title: "Why priateľom?",
		topic: "Instrumental Case: Accompaniment with 's'",
		explanation:
			"The preposition **s** / **so** (with) indicates accompaniment and governs the **instrumental case**.\n\nMasculine nouns (both animate and inanimate) take the ending **-om** in the instrumental singular:\n• *priateľ* (friend) → *s priateľom* (with a friend)\n• *brat* (brother) → *s bratom* (with a brother).\n\n*Priateľ* is nominative; *priateľa* is genitive/accusative. The instrumental suffix is **-om**.",
	},
	{
		sentence: "Cestujem vlakom.",
		answer: "vlakom",
		lemma: "vlak",
		commonGiven: "vlak",
		title: "Why vlakom?",
		topic: "Instrumental Case: Means of Transport",
		explanation:
			"In Slovak, means of transport (by train, by car, by bus) are expressed directly in the **instrumental case without a preposition**:\n• *vlak* (train) → *vlakom* (by train)\n• *auto* (car) → *autom* (by car)\n• *autobus* (bus) → *autobusom* (by bus).\n\nSaying *s vlakom* is a common anglicism meaning 'in company with a train'. The bare instrumental *vlakom* is the authentic Slovak structure.",
	},
	{
		sentence: "Platím kartou.",
		answer: "kartou",
		lemma: "karta",
		commonGiven: "karta",
		title: "Why kartou?",
		topic: "Instrumental Case: Feminine Nouns in -a",
		explanation:
			"To express the means by which an action is performed, Slovak uses the **instrumental case**.\n\nFeminine nouns ending in **-a** (like **karta** — card) take the instrumental singular ending **-ou**:\n• *karta* → *kartou* (by card, with a card).\n\nTherefore, paying by card is *platím kartou*. The ending **-ou** is the hallmark of the feminine instrumental singular.",
	},

	// 5. Present Tense Verb Conjugation
	{
		sentence: "Počúvam hudbu.",
		answer: "Počúvam",
		lemma: "počúvať",
		commonGiven: "počúvať",
		title: "Why Počúvam?",
		topic: "Present Tense: 1st Person Singular (-am)",
		explanation:
			'In Slovak, when you express what you yourself are doing in the present tense ("I listen"), you must conjugate the infinitive verb **počúvať** into the 1st person singular present form: **počúvam** (ending in **-am**).\n\nThe form *počúvať* is the bare dictionary infinitive ("to listen"). In Slovak, subject pronouns (like *ja*) are usually omitted because the verb ending **-am** explicitly identifies that "I" am the subject.',
	},
	{
		sentence: "Hovorím po slovensky.",
		answer: "Hovorím",
		lemma: "hovoriť",
		commonGiven: "hovoriť",
		title: "Why Hovorím?",
		topic: "Present Tense: -iť Verb Conjugation",
		explanation:
			'The verb **hovoriť** (to speak) belongs to the *-iť* conjugation class.\n\nIn the present tense, its 1st person singular ("I speak") takes the long ending **-ím**:\n• *Ja hovorím po slovensky.* (I speak Slovak).\n\n*Hovoriť* is the infinitive. For "you speak" it would be *hovoríš*, and for "he/she speaks" *hovorí*.',
	},
	{
		sentence: "Bývam v hoteli.",
		answer: "Bývam",
		lemma: "bývať",
		commonGiven: "býva",
		title: "Why Bývam?",
		topic: "Present Tense: Person Agreement (1st Person vs 3rd Person)",
		explanation:
			'To express where YOU live, you need the 1st person singular form:\n• *bývam* = I live (1st person, ending **-am**)\n• *bývaš* = you live (2nd person, ending **-aš**)\n• *býva* = he/she lives (3rd person, ending **-a**).\n\nIf the sentence means "I live in a hotel", the correct conjugated form is **Bývam**.',
	},
	{
		sentence: "Chodím do školy.",
		answer: "Chodím",
		lemma: "chodiť",
		commonGiven: "ísť",
		title: "Why Chodím?",
		topic: "Verbs of Motion: Habitual 'chodiť' vs Unidirectional 'ísť'",
		explanation:
			'Slovak distinguishes between unidirectional movement and repeated/habitual movement:\n• **ísť** (idem) = to go right now, on one specific trip ("Idem do školy" = I am on my way to school now).\n• **chodiť** (chodím) = to go habitually, regularly, or attend ("Chodím do školy" = I attend school / I go to school every day).\n\nFor regular habitual actions like attending school or work, **chodiť** (*chodím*) is the proper lexical choice.',
	},

	// 6. Verb Aspect (Dokonavý vs Nedokonavý)
	{
		sentence: "Kúpim knihu.",
		answer: "Kúpim",
		lemma: "kúpiť",
		commonGiven: "kupujem",
		title: "Why Kúpim?",
		topic: "Verb Aspect: Perfective Present = Future Meaning",
		explanation:
			'**Kúpiť** is a **perfective** (dokonavý) verb, while **kupovať** is **imperfective** (nedokonavý).\n\nIn Slovak, perfective verbs do not have a continuous present tense. Their present conjugated forms (*kúpim, kúpiš, kúpi...*) automatically express a **completed future action**:\n• *Kúpim knihu.* = I will buy a book (the purchase will be completed).\n• *Kupujem knihu.* = I am currently in the process of buying a book.\n\nTo express "I\'ll buy a book", use the perfective form *kúpim*.',
	},
	{
		sentence: "Urobím to zajtra.",
		answer: "Urobím",
		lemma: "urobiť",
		commonGiven: "robím",
		title: "Why Urobím?",
		topic: "Verb Aspect: 'urobiť' vs 'robiť'",
		explanation:
			'**Robiť** is imperfective (the process of doing/making), whereas **urobiť** is perfective (accomplishing / finishing the task).\n\nWhen speaking of completing an action tomorrow (*zajtra*), Slovak prefers the perfective aspect:\n• *Urobím to zajtra.* = I will do it / get it done tomorrow.\n• *Robím to zajtra.* sounds like "I am doing it tomorrow" without emphasizing completion.',
	},
];

export function whyKey(lang: string, sentence: string, answer: string): string {
	return crypto
		.createHash("sha256")
		.update(`${lang}\0${sentence.normalize("NFC").trim()}\0${answer.normalize("NFC").trim()}`)
		.digest("hex")
		.slice(0, 24);
}

export function generateWhyIndex(): number {
	const whyFile = path.join(PATHS.lessons, "why-index.json");
	const chatsDir = PATHS.chats;
	fs.mkdirSync(chatsDir, { recursive: true });
	fs.mkdirSync(path.dirname(whyFile), { recursive: true });

	let existingEntries: Record<string, any> = {};
	try {
		const parsed = JSON.parse(fs.readFileSync(whyFile, "utf-8"));
		if (parsed && typeof parsed.entries === "object") existingEntries = parsed.entries;
	} catch {
		existingEntries = {};
	}

	const now = new Date().toISOString();
	let createdCount = 0;

	for (const seed of WHY_SEEDS) {
		const key = whyKey("sk", seed.sentence, seed.answer);
		const chatId = `chat_why_${key}`;
		const chatPath = path.join(chatsDir, `${chatId}.json`);

		// 1. Create or ensure chat file exists with full explanation messages
		const userMsg = {
			id: `msg_u_${key.slice(0, 8)}`,
			role: "user",
			content: `Why is the answer "${seed.answer}" in "${seed.sentence}"? (I thought "${seed.commonGiven}")`,
		};

		const assistantMsg = {
			id: `msg_a_${key.slice(0, 8)}`,
			role: "assistant",
			content: `### ${seed.topic}\n\n${seed.explanation}`,
		};

		const chatRecord = {
			version: 1,
			id: chatId,
			title: seed.title,
			kind: "chat",
			createdAt: now,
			updatedAt: now,
			messages: [userMsg, assistantMsg],
		};

		fs.writeFileSync(chatPath, JSON.stringify(chatRecord, null, "\t"), "utf-8");

		// 2. Register in why-index.json
		existingEntries[key] = {
			key,
			lang: "sk",
			sentence: seed.sentence,
			answer: seed.answer,
			lemma: seed.lemma,
			given: seed.commonGiven,
			chatId,
			createdAt: now,
			reused: 0,
		};

		createdCount++;
	}

	fs.writeFileSync(whyFile, JSON.stringify({ version: 1, entries: existingEntries }, null, "\t"), "utf-8");
	return createdCount;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "")) {
	const count = generateWhyIndex();
	console.log(`Successfully generated ${count} pre-indexed 'Why?' explanations and practice chats.`);
}
