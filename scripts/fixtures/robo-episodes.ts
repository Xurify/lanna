/**
 * Four hand-made "Robo in Bratislava" episodes, for trying the Read screens without writing stories
 * with a model (Quiet tool, 2026-11-03).
 *
 * THE SLOVAK HERE WAS WRITTEN BY A MODEL AND NEEDS A NATIVE SPEAKER'S CHECK before anyone learns from
 * it. Every sentence is listed below with its English translation so it can be read through; a
 * correction is a one-line edit in this file, then re-run the seed.
 *
 * Run it into a scratch profile (never the real one):
 *   npm run dev:sandbox -- --seed          # the sandbox seed now includes these episodes
 *   LH_DATA_DIR=<scratch folder> npx tsx scripts/seed-stories.ts
 *
 * Glosses are the dictionary form and the English meaning of each word as used in the sentence; a word
 * that is not in the glossary is left unglossed (the popover then shows only the word).
 *
 * ── Episode 1, A1, "Robo na trhu" (Robo at the market)
 *  1. Dnes je pekne.                                  Today the weather is nice.
 *  2. Robo ide na trh.                                Robo goes to the market.
 *  3. Chce kúpiť chlieb.                              He wants to buy bread.
 *  4. Na trhu je veľa ľudí.                           There are many people at the market.
 *  5. Predavačka hovorí: „Dobrý deň!“                 The saleswoman says: "Good day!"
 *  6. Robo hovorí: „Dobrý deň. Jeden chlieb, prosím.“ Robo says: "Good day. One bread, please."
 *  7. Chlieb stojí dve eurá.                          The bread costs two euros.
 *  8. Robo platí a hovorí: „Ďakujem.“                 Robo pays and says: "Thank you."
 *
 * ── Episode 2, A1, "Robo v kaviarni" (Robo in the café)
 *  1. Robo je v kaviarni.                             Robo is in the café.
 *  2. Sedí pri okne.                                  He sits by the window.
 *  3. Čašník príde k stolu.                           The waiter comes to the table.
 *  4. Robo si dá kávu a koláč.                        Robo orders a coffee and a cake.
 *  5. Káva je horúca.                                 The coffee is hot.
 *  6. Koláč je sladký.                                The cake is sweet.
 *  7. Robo pije kávu a číta noviny.                   Robo drinks his coffee and reads the newspaper.
 *
 * ── Episode 3, A2, "Robo hľadá stanicu" (Robo looks for the station)
 *  1. Robo je v centre Bratislavy.                    Robo is in the centre of Bratislava.
 *  2. Chce ísť na stanicu, ale nevie, kde je.         He wants to go to the station but does not know where it is.
 *  3. Pri fontáne stojí mladá žena.                   A young woman stands by the fountain.
 *  4. Robo sa jej pýta: „Prepáčte, kde je železničná stanica?“   Robo asks her: "Excuse me, where is the railway station?"
 *  5. Žena odpovedá: „Choďte rovno a potom doľava.“   The woman answers: "Go straight and then left."
 *  6. „Je to ďaleko?“ pýta sa Robo.                   "Is it far?" Robo asks.
 *  7. „Nie, stanica je len desať minút odtiaľto.“     "No, the station is only ten minutes from here."
 *  8. Robo poďakuje a ide rovno.                      Robo thanks her and goes straight.
 *  9. Po desiatich minútach vidí veľkú budovu.        After ten minutes he sees a big building.
 * 10. To je stanica! Robo kúpi lístok do Košíc.       That is the station! Robo buys a ticket to Košice.
 * 11. Vlak odchádza o druhej.                         The train leaves at two.
 * 12. Robo má ešte čas, a tak si kúpi vodu.           Robo still has time, so he buys water.
 *
 * ── Episode 4, B1, "Robo a víkendový výlet" (Robo and the weekend trip)
 *  1. Minulý víkend sa Robo rozhodol, že pôjde na výlet do Malých Karpát.   Last weekend Robo decided to go on a trip to the Little Carpathians.
 *  2. V sobotu ráno vstal skoro, lebo chcel stihnúť prvý autobus.           On Saturday morning he got up early because he wanted to catch the first bus.
 *  3. Do batohu si zbalil vodu, chlieb so syrom a teplú bundu.              Into his backpack he packed water, bread with cheese and a warm jacket.
 *  4. Autobus išiel pomaly, ale cesta bola krásna.                          The bus went slowly, but the ride was beautiful.
 *  5. Keď vystúpil, pozrel sa na mapu a hľadal značku.                      When he got off, he looked at the map and searched for the trail mark.
 *  6. Chodník viedol cez hustý les.                                         The path led through a dense forest.
 *  7. Po hodine začalo pršať, preto si obliekol bundu.                      After an hour it began to rain, so he put on his jacket.
 *  8. Na vrchu stála malá chata, kde si Robo oddýchol.                      On the top stood a small hut, where Robo rested.
 *  9. Majiteľka mu priniesla horúci čaj a povedala: „Takéto počasie je v horách bežné.“   The owner brought him hot tea and said: "Weather like this is common in the mountains."
 * 10. Robo sa usmial a odpovedal, že mu to vôbec nevadí.                    Robo smiled and answered that he did not mind at all.
 * 11. Keď dážď prestal, pokračoval ďalej k rozhľadni.                       When the rain stopped, he carried on to the lookout tower.
 * 12. Z rozhľadne videl celé údolie aj vzdialenú Bratislavu.                From the tower he saw the whole valley and distant Bratislava.
 * 13. Domov sa vrátil unavený, ale spokojný.                                He came home tired but content.
 * 14. V nedeľu napísal kamarátovi, že na ten výlet nikdy nezabudne.         On Sunday he wrote to his friend that he would never forget that trip.
 */

export interface FixtureEpisode {
	id: string;
	episode: number;
	title: string;
	level: "A1" | "A2" | "B1";
	theme: string;
	recap: string;
	sentences: Array<{ sk: string; en: string }>;
	/** form (lower case) → [dictionary form, English meaning]. */
	glossary: Record<string, [string, string]>;
	/** Dictionary forms introduced on purpose: glossed in the text and listed under it. */
	newWords: Array<{ lemma: string; gloss: string }>;
	questions: Array<{ q: string; options: string[]; answer: number }>;
}

export const ROBO_EPISODES: FixtureEpisode[] = [
	{
		id: "ep-001-robo-na-trhu",
		episode: 1,
		title: "Robo na trhu",
		level: "A1",
		theme: "At the market",
		recap: "Robo buys a bread at the market.",
		sentences: [
			{ sk: "Dnes je pekne.", en: "Today the weather is nice." },
			{ sk: "Robo ide na trh.", en: "Robo goes to the market." },
			{ sk: "Chce kúpiť chlieb.", en: "He wants to buy bread." },
			{ sk: "Na trhu je veľa ľudí.", en: "There are many people at the market." },
			{ sk: "Predavačka hovorí: „Dobrý deň!“", en: "The saleswoman says: \"Good day!\"" },
			{ sk: "Robo hovorí: „Dobrý deň. Jeden chlieb, prosím.“", en: "Robo says: \"Good day. One bread, please.\"" },
			{ sk: "Chlieb stojí dve eurá.", en: "The bread costs two euros." },
			{ sk: "Robo platí a hovorí: „Ďakujem.“", en: "Robo pays and says: \"Thank you.\"" },
		],
		glossary: {
			dnes: ["dnes", "today"], je: ["byť", "is"], pekne: ["pekne", "nice (weather)"], robo: ["Robo", "Robo"], ide: ["ísť", "goes"], na: ["na", "to, at"], trh: ["trh", "market"], trhu: ["trh", "market"],
			chce: ["chcieť", "wants"], kúpiť: ["kúpiť", "to buy"], chlieb: ["chlieb", "bread"], veľa: ["veľa", "many, a lot of"], ľudí: ["ľudia", "people"], predavačka: ["predavačka", "saleswoman"],
			hovorí: ["hovoriť", "says, speaks"], dobrý: ["dobrý", "good"], deň: ["deň", "day"], jeden: ["jeden", "one"], prosím: ["prosím", "please"], stojí: ["stáť", "costs, stands"], dve: ["dva", "two"], eurá: ["euro", "euros"],
			platí: ["platiť", "pays"], a: ["a", "and"], ďakujem: ["ďakovať", "thank you"],
		},
		newWords: [{ lemma: "trh", gloss: "market" }, { lemma: "chlieb", gloss: "bread" }, { lemma: "predavačka", gloss: "saleswoman" }],
		questions: [
			{ q: "Where does Robo go?", options: ["To the market", "To school", "To the station"], answer: 0 },
			{ q: "What does Robo want to buy?", options: ["Coffee", "Bread", "Water"], answer: 1 },
			{ q: "How much does the bread cost?", options: ["One euro", "Two euros", "Three euros"], answer: 1 },
		],
	},
	{
		id: "ep-002-robo-v-kaviarni",
		episode: 2,
		title: "Robo v kaviarni",
		level: "A1",
		theme: "In a café",
		recap: "Robo has a coffee and a cake in a café.",
		sentences: [
			{ sk: "Robo je v kaviarni.", en: "Robo is in the café." },
			{ sk: "Sedí pri okne.", en: "He sits by the window." },
			{ sk: "Čašník príde k stolu.", en: "The waiter comes to the table." },
			{ sk: "Robo si dá kávu a koláč.", en: "Robo orders a coffee and a cake." },
			{ sk: "Káva je horúca.", en: "The coffee is hot." },
			{ sk: "Koláč je sladký.", en: "The cake is sweet." },
			{ sk: "Robo pije kávu a číta noviny.", en: "Robo drinks his coffee and reads the newspaper." },
		],
		glossary: {
			robo: ["Robo", "Robo"], je: ["byť", "is"], v: ["v", "in"], kaviarni: ["kaviareň", "café"], sedí: ["sedieť", "sits"], pri: ["pri", "by, at"], okne: ["okno", "window"],
			čašník: ["čašník", "waiter"], príde: ["prísť", "comes"], k: ["k", "to"], stolu: ["stôl", "table"], si: ["si", "for himself"], dá: ["dať", "gives; orders"],
			kávu: ["káva", "coffee"], a: ["a", "and"], koláč: ["koláč", "cake"], káva: ["káva", "coffee"], horúca: ["horúci", "hot"], sladký: ["sladký", "sweet"],
			pije: ["piť", "drinks"], číta: ["čítať", "reads"], noviny: ["noviny", "newspaper"],
		},
		newWords: [{ lemma: "čašník", gloss: "waiter" }, { lemma: "koláč", gloss: "cake" }, { lemma: "noviny", gloss: "newspaper" }],
		questions: [
			{ q: "Where is Robo?", options: ["In a café", "At the market", "At home"], answer: 0 },
			{ q: "Where does he sit?", options: ["By the door", "By the window", "At the bar"], answer: 1 },
			{ q: "What does Robo read?", options: ["A book", "A menu", "The newspaper"], answer: 2 },
		],
	},
	{
		id: "ep-003-robo-hlada-stanicu",
		episode: 3,
		title: "Robo hľadá stanicu",
		level: "A2",
		theme: "Asking the way",
		recap: "Robo asks a woman the way to the station and buys a ticket.",
		sentences: [
			{ sk: "Robo je v centre Bratislavy.", en: "Robo is in the centre of Bratislava." },
			{ sk: "Chce ísť na stanicu, ale nevie, kde je.", en: "He wants to go to the station but does not know where it is." },
			{ sk: "Pri fontáne stojí mladá žena.", en: "A young woman stands by the fountain." },
			{ sk: "Robo sa jej pýta: „Prepáčte, kde je železničná stanica?“", en: "Robo asks her: \"Excuse me, where is the railway station?\"" },
			{ sk: "Žena odpovedá: „Choďte rovno a potom doľava.“", en: "The woman answers: \"Go straight and then left.\"" },
			{ sk: "„Je to ďaleko?“ pýta sa Robo.", en: "\"Is it far?\" Robo asks." },
			{ sk: "„Nie, stanica je len desať minút odtiaľto.“", en: "\"No, the station is only ten minutes from here.\"" },
			{ sk: "Robo poďakuje a ide rovno.", en: "Robo thanks her and goes straight." },
			{ sk: "Po desiatich minútach vidí veľkú budovu.", en: "After ten minutes he sees a big building." },
			{ sk: "To je stanica! Robo kúpi lístok do Košíc.", en: "That is the station! Robo buys a ticket to Košice." },
			{ sk: "Vlak odchádza o druhej.", en: "The train leaves at two." },
			{ sk: "Robo má ešte čas, a tak si kúpi vodu.", en: "Robo still has time, so he buys water." },
		],
		glossary: {
			robo: ["Robo", "Robo"], je: ["byť", "is"], v: ["v", "in"], centre: ["centrum", "centre"], bratislavy: ["Bratislava", "Bratislava"], chce: ["chcieť", "wants"], ísť: ["ísť", "to go"],
			na: ["na", "to, at"], stanicu: ["stanica", "station"], stanica: ["stanica", "station"], ale: ["ale", "but"], nevie: ["vedieť", "does not know"], kde: ["kde", "where"],
			pri: ["pri", "by"], fontáne: ["fontána", "fountain"], stojí: ["stáť", "stands"], mladá: ["mladý", "young"], žena: ["žena", "woman"], sa: ["sa", "(reflexive)"], jej: ["ona", "her"],
			pýta: ["pýtať sa", "asks"], prepáčte: ["prepáčiť", "excuse me"], železničná: ["železničný", "railway"], odpovedá: ["odpovedať", "answers"], choďte: ["ísť", "go (polite)"],
			rovno: ["rovno", "straight"], a: ["a", "and"], potom: ["potom", "then"], doľava: ["doľava", "to the left"], to: ["to", "it, that"], ďaleko: ["ďaleko", "far"], nie: ["nie", "no"],
			len: ["len", "only"], desať: ["desať", "ten"], minút: ["minúta", "minutes"], odtiaľto: ["odtiaľto", "from here"], poďakuje: ["poďakovať", "thanks"], ide: ["ísť", "goes"],
			po: ["po", "after"], desiatich: ["desať", "ten"], minútach: ["minúta", "minutes"], vidí: ["vidieť", "sees"], veľkú: ["veľký", "big"], budovu: ["budova", "building"],
			kúpi: ["kúpiť", "buys"], lístok: ["lístok", "ticket"], do: ["do", "to, into"], košíc: ["Košice", "Košice"], vlak: ["vlak", "train"], odchádza: ["odchádzať", "leaves"], o: ["o", "at (time)"],
			druhej: ["druhý", "second (two o'clock)"], má: ["mať", "has"], ešte: ["ešte", "still"], čas: ["čas", "time"], tak: ["tak", "so"], si: ["si", "for himself"], vodu: ["voda", "water"],
		},
		newWords: [{ lemma: "stanica", gloss: "station" }, { lemma: "fontána", gloss: "fountain" }, { lemma: "lístok", gloss: "ticket" }],
		questions: [
			{ q: "What does Robo want to find?", options: ["The station", "A café", "The market"], answer: 0 },
			{ q: "Who does Robo ask for help?", options: ["A waiter", "A young woman", "A driver"], answer: 1 },
			{ q: "Where does Robo buy a ticket to?", options: ["Prague", "Vienna", "Košice"], answer: 2 },
		],
	},
	{
		id: "ep-004-robo-a-vikendovy-vylet",
		episode: 4,
		title: "Robo a víkendový výlet",
		level: "B1",
		theme: "A weekend trip",
		recap: "Robo walks in the Little Carpathians, gets rained on and rests in a hut.",
		sentences: [
			{ sk: "Minulý víkend sa Robo rozhodol, že pôjde na výlet do Malých Karpát.", en: "Last weekend Robo decided to go on a trip to the Little Carpathians." },
			{ sk: "V sobotu ráno vstal skoro, lebo chcel stihnúť prvý autobus.", en: "On Saturday morning he got up early because he wanted to catch the first bus." },
			{ sk: "Do batohu si zbalil vodu, chlieb so syrom a teplú bundu.", en: "Into his backpack he packed water, bread with cheese and a warm jacket." },
			{ sk: "Autobus išiel pomaly, ale cesta bola krásna.", en: "The bus went slowly, but the ride was beautiful." },
			{ sk: "Keď vystúpil, pozrel sa na mapu a hľadal značku.", en: "When he got off, he looked at the map and searched for the trail mark." },
			{ sk: "Chodník viedol cez hustý les.", en: "The path led through a dense forest." },
			{ sk: "Po hodine začalo pršať, preto si obliekol bundu.", en: "After an hour it began to rain, so he put on his jacket." },
			{ sk: "Na vrchu stála malá chata, kde si Robo oddýchol.", en: "On the top stood a small hut, where Robo rested." },
			{ sk: "Majiteľka mu priniesla horúci čaj a povedala: „Takéto počasie je v horách bežné.“", en: "The owner brought him hot tea and said: \"Weather like this is common in the mountains.\"" },
			{ sk: "Robo sa usmial a odpovedal, že mu to vôbec nevadí.", en: "Robo smiled and answered that he did not mind at all." },
			{ sk: "Keď dážď prestal, pokračoval ďalej k rozhľadni.", en: "When the rain stopped, he carried on to the lookout tower." },
			{ sk: "Z rozhľadne videl celé údolie aj vzdialenú Bratislavu.", en: "From the tower he saw the whole valley and distant Bratislava." },
			{ sk: "Domov sa vrátil unavený, ale spokojný.", en: "He came home tired but content." },
			{ sk: "V nedeľu napísal kamarátovi, že na ten výlet nikdy nezabudne.", en: "On Sunday he wrote to his friend that he would never forget that trip." },
		],
		glossary: {
			minulý: ["minulý", "last"], víkend: ["víkend", "weekend"], sa: ["sa", "(reflexive)"], robo: ["Robo", "Robo"], rozhodol: ["rozhodnúť sa", "decided"], že: ["že", "that"], pôjde: ["ísť", "will go"],
			na: ["na", "on, to"], výlet: ["výlet", "trip"], do: ["do", "to, into"], malých: ["malý", "small"], karpát: ["Karpaty", "the Carpathians"], v: ["v", "in, on"], sobotu: ["sobota", "Saturday"],
			ráno: ["ráno", "morning"], vstal: ["vstať", "got up"], skoro: ["skoro", "early"], lebo: ["lebo", "because"], chcel: ["chcieť", "wanted"], stihnúť: ["stihnúť", "to catch"], prvý: ["prvý", "first"],
			autobus: ["autobus", "bus"], batohu: ["batoh", "backpack"], si: ["si", "for himself"], zbalil: ["zbaliť", "packed"], vodu: ["voda", "water"], chlieb: ["chlieb", "bread"], so: ["s", "with"],
			syrom: ["syr", "cheese"], a: ["a", "and"], teplú: ["teplý", "warm"], bundu: ["bunda", "jacket"], išiel: ["ísť", "went"], pomaly: ["pomaly", "slowly"], ale: ["ale", "but"], cesta: ["cesta", "ride, road"],
			bola: ["byť", "was"], krásna: ["krásny", "beautiful"], keď: ["keď", "when"], vystúpil: ["vystúpiť", "got off"], pozrel: ["pozrieť sa", "looked"], mapu: ["mapa", "map"], hľadal: ["hľadať", "searched for"],
			značku: ["značka", "trail mark"], chodník: ["chodník", "path"], viedol: ["viesť", "led"], cez: ["cez", "through"], hustý: ["hustý", "dense"], les: ["les", "forest"], po: ["po", "after"],
			hodine: ["hodina", "hour"], začalo: ["začať", "began"], pršať: ["pršať", "to rain"], preto: ["preto", "so, therefore"], obliekol: ["obliecť", "put on"], vrchu: ["vrch", "top, hill"],
			stála: ["stáť", "stood"], malá: ["malý", "small"], chata: ["chata", "hut"], kde: ["kde", "where"], oddýchol: ["oddýchnuť si", "rested"], majiteľka: ["majiteľka", "owner"], mu: ["on", "to him"],
			priniesla: ["priniesť", "brought"], horúci: ["horúci", "hot"], čaj: ["čaj", "tea"], povedala: ["povedať", "said"], takéto: ["takýto", "such, like this"], počasie: ["počasie", "weather"],
			je: ["byť", "is"], horách: ["hora", "mountains"], bežné: ["bežný", "common"], usmial: ["usmiať sa", "smiled"], odpovedal: ["odpovedať", "answered"], to: ["to", "it"], vôbec: ["vôbec", "at all"],
			nevadí: ["vadiť", "does not mind"], dážď: ["dážď", "rain"], prestal: ["prestať", "stopped"], pokračoval: ["pokračovať", "carried on"], ďalej: ["ďalej", "further"], k: ["k", "to"],
			rozhľadni: ["rozhľadňa", "lookout tower"], z: ["z", "from"], rozhľadne: ["rozhľadňa", "lookout tower"], videl: ["vidieť", "saw"], celé: ["celý", "whole"], údolie: ["údolie", "valley"],
			aj: ["aj", "and, also"], vzdialenú: ["vzdialený", "distant"], bratislavu: ["Bratislava", "Bratislava"], domov: ["domov", "home"], vrátil: ["vrátiť sa", "returned"], unavený: ["unavený", "tired"],
			spokojný: ["spokojný", "content"], nedeľu: ["nedeľa", "Sunday"], napísal: ["napísať", "wrote"], kamarátovi: ["kamarát", "friend"], ten: ["ten", "that"], nikdy: ["nikdy", "never"],
			nezabudne: ["zabudnúť", "will not forget"],
		},
		newWords: [{ lemma: "batoh", gloss: "backpack" }, { lemma: "chata", gloss: "mountain hut" }, { lemma: "rozhľadňa", gloss: "lookout tower" }],
		questions: [
			{ q: "Why did Robo get up early?", options: ["To catch the first bus", "To go to work", "To buy bread"], answer: 0 },
			{ q: "What happened after an hour on the path?", options: ["He got lost", "It began to rain", "He met a friend"], answer: 1 },
			{ q: "What did Robo see from the tower?", options: ["The whole valley and Bratislava", "Only the forest", "The railway station"], answer: 0 },
		],
	},
];
