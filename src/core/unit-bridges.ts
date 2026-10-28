/**
 * THE BRIDGES (2026-10-28): the same grammar point seen from a language the
 * learner already knows. Each grammar unit in src/core/lesson.ts carries an
 * Estonian line (`bridge`, spec D3); this file adds Finnish, Russian and
 * German, and `unitBridges()` picks the ones the learner's profile lists
 * (Xurify: "sometimes I do want to see the Estonian way and not just
 * English, or other languages"). A line is a hook, not a second lesson:
 * one parallel, and the place where the other language misleads.
 */

import { BRIDGE_LANGS, languageName, type BridgeLang } from "./onboarding.ts";
import { UNITS, type UnitId } from "./lesson.ts";

type Lines = Partial<Record<Exclude<BridgeLang, "et">, string>>;

const MORE: Partial<Record<UnitId, Lines>> = {
	present: {
		fi: "Like Finnish: minä teen ≈ ja robím, me teemme ≈ my robíme, te teette ≈ vy robíte.",
		ru: "The same endings as Russian делаю / делаешь / делает / делаем / делаете; only the ja form differs, -m (robím) where Russian has -ю.",
		de: "Like ich mache / du machst / wir machen / ihr macht: an ending per person. Slovak drops the pronoun because the ending already says who.",
	},
	"acc-fem": {
		fi: "The object case, like Finnish juon kahvia, näen siskon: Pijem kávu, Vidím sestru; Slovak has one object ending here, -u.",
		ru: "The same -а → -у as Russian вижу сестру, читаю книгу: Vidím sestru, čítam knihu.",
		de: "The direct object changes its form, like der → den; for a Slovak noun in -a the change is the ending -u: Mám sestru.",
	},
	loc: {
		fi: "Like the Finnish place cases: v meste ≈ kaupungissa (inessive -ssa), na stole ≈ pöydällä (adessive -lla).",
		ru: "The Russian prepositional after в / на / о: в городе ≈ v meste, на столе ≈ na stole, о школе ≈ o škole.",
		de: "Like the German dative after in / an / auf for a place (im Haus, auf dem Tisch); Slovak has a case of its own for it, the locative: v dome, na stole.",
	},
	"acc-people": {
		fi: "A male person as the object, like Finnish näen veljen: Vidím brata; the ending is -a.",
		ru: "Exactly the Russian animate accusative: вижу брата ≈ Vidím brata, знаю учителя ≈ Poznám učiteľa.",
		de: "Like den Bruder, den Lehrer: a male person as the object changes form; in Slovak the change is the ending -a: Vidím brata.",
	},
	gen: {
		fi: "do školy ≈ kouluun (illative), zo školy ≈ koulusta (elative), bez cukru ≈ ilman sokeria.",
		ru: "The same prepositions take the genitive in Russian: до школы ≈ do školy, из школы ≈ zo školy, без сахара ≈ bez cukru.",
		de: "Like German prepositions that fix a case (ohne + accusative, aus + dative), these fix the genitive: bez cukru ≈ ohne Zucker, zo školy ≈ aus der Schule.",
	},
	ins: {
		fi: "Like Finnish -n kanssa for company and -lla for a means: s kamarátom ≈ ystävän kanssa, autobusom ≈ bussilla.",
		ru: "The instrumental as in Russian: с другом ≈ s kamarátom, перед домом ≈ pred domom, автобусом ≈ autobusom.",
		de: "Like mit dem Freund, where mit always takes the dative: s kamarátom. For a means Slovak drops the preposition: autobusom ≈ mit dem Bus.",
	},
	adj: {
		fi: "Adjectives agree, as in Finnish: uusi kirja → uudet kirjat ≈ nová kniha → nové knihy.",
		ru: "Adjectives agree as in Russian новый дом / новая книга / новое место ≈ nový dom / nová kniha / nové mesto; the Slovak endings are -ý, -á, -é.",
		de: "As in ein neues Haus / eine neue Frau: the adjective agrees with the noun's gender; in Slovak the endings are -ý, -á, -é.",
	},
	past: {
		fi: "Built like the Finnish perfect: an -l form plus 'be' (robil som ~ olen tehnyt), with som / si only for I and you.",
		ru: "The same -л form as Russian делал / делала / делали; the difference is som / si: Russian says я делал, Slovak robil som, and the auxiliary carries the person.",
		de: "Like the German perfect ich habe gemacht: a participle plus an auxiliary. In Slovak the -l form plus som / si, and no auxiliary at all for he, she and they.",
	},
	dat: {
		fi: "Like the Finnish allative -lle: k bratovi ≈ veljelle, dal som mame ≈ annoin äidille.",
		ru: "The dative as in Russian к брату ≈ k bratovi, дал маме ≈ dal som mame; Slovak k becomes ku before k- and g-.",
		de: "The German dative after zu / gegenüber / dank: zum Bruder ≈ k bratovi, dank der Mutter ≈ vďaka mame.",
	},
	"modal-inf": {
		fi: "As in Finnish haluan mennä, minun täytyy tehdä: the second verb stays in the infinitive; Slovak has one infinitive, in -ť.",
		ru: "Exactly хочу идти, должен работать: the second verb stays in the infinitive; in Slovak every infinitive ends in -ť.",
		de: "Exactly ich will gehen, ich muss arbeiten: the second verb is an infinitive, at the end in German, right after the modal in Slovak.",
	},
	"kam-kde": {
		fi: "Exactly the Finnish pair kaupunkiin (minne?) and kaupungissa (missä?), asemalle and asemalla: do mesta / v meste, na stanicu / na stanici.",
		ru: "The Russian pair в город (куда?) / в городе (где?) ≈ do mesta / v meste; note that Slovak says do + genitive for 'into', where Russian says в + accusative.",
		de: "The German Wechselpräpositionen: in die Stadt (wohin? accusative) and in der Stadt (wo? dative) ≈ do mesta / v meste; Slovak uses accusative and locative the same way.",
	},
	"present-ujem": {
		fi: "A fixed stem change, like oppia → opin: learn the stem once; the endings are the usual ones.",
		ru: "Like Russian работать → работаю, работаешь: -ова- becomes -уj- in the present; Slovak pracujem, pracuješ.",
		de: "A stem you learn once, like wissen → ich weiß: pracovať → pracujem, and the endings are the usual -m, -š, -, -me, -te, -ú.",
	},
	"present-em": {
		fi: "Like Finnish verbs whose stem shifts between forms (tulla → tulen): memorise the minä / ja form and the rest follows.",
		ru: "The Russian first conjugation with a stem change: писать → пишу, пишешь ≈ písať → píšem, píšeš; нести → несу ≈ niesť → nesiem.",
		de: "Like lesen → du liest, nehmen → du nimmst: the stem shifts; memorise the ja form and the rest follows.",
	},
	plural: {
		fi: "Finnish has one plural marker -t (talot, naiset); Slovak picks the ending by gender, and male people get their own.",
		ru: "Close to Russian дома / женщины / города, with the same twist for male people (студенты, братья ≈ študenti, bratia); the Slovak neuter plural is -á (mestá).",
		de: "German has five plural patterns (Häuser, Frauen, Tische); Slovak picks by gender: -y, -y / -e, -á, and male people get -i / -ia / -ovia.",
	},
	numbers: {
		fi: "Finnish puts every counted noun in the singular partitive (viisi kahvia); Slovak counts 2–4 as a plural and 5+ as 'of' (genitive).",
		ru: "The 5+ rule is Russian's (пять домов ≈ päť domov); the difference is 2–4: Russian два дома (genitive singular), Slovak dva domy (nominative plural).",
		de: "German keeps the noun plural after any number (fünf Häuser); Slovak counts 2–4 as a plural (tri domy) and 5+ as 'of' (päť domov), like fünf Kilo Äpfel.",
	},
	cond: {
		fi: "Finnish puts -isi- in the verb (tekisin, menisimme); Slovak keeps the -l form and adds the little word by in second position.",
		ru: "Russian делал бы ≈ Slovak robil by; the difference is the person marker: Slovak adds som / si (robil by som), and by sits in second position.",
		de: "Like würde + infinitive, but Slovak keeps the past -l form and adds the particle by: robil by som ≈ ich würde machen.",
	},
	"core-verbs": {
		fi: "Like olla, mennä, tulla in Finnish, which are irregular too: learn these by heart.",
		ru: "Mostly cognates of Russian irregulars: idem ≈ иду, chcem ≈ хочу, môžem ≈ могу, jem ≈ ем; but mám has no Russian twin (у меня есть), and viem covers both знаю and умею.",
		de: "Like sein, haben, wissen in German, the commonest verbs are irregular: learn mám, idem, chcem, môžem, viem, jem by heart.",
	},
	motion: {
		fi: "Finnish mennä / käydä is close: lähden kouluun (one trip) ≈ idem do školy, käyn koulussa (the habit) ≈ chodím do školy.",
		ru: "The Russian идти / ходить pair, one to one: idem do školy ≈ иду в школу, chodím do školy ≈ хожу в школу.",
		de: "German says ich gehe for both; Slovak splits one trip (idem) from the habit (chodím), like 'I am going' and 'I go'.",
	},
	clitics: {
		fi: "Finnish has no such slot: in Slovak these words come right after the first stressed phrase, whatever else moves.",
		ru: "Russian has no fixed slot (я вчера учился); in Slovak sa / som / mi come right after the first stressed phrase: Včera som sa učil.",
		de: "Like German verb-second, but for the little words: sa / som / mi stand in second position in the clause, after the first stressed phrase.",
	},
	"adj-cases": {
		fi: "As in Finnish, where the adjective follows the noun into every case (uudessa koulussa, hyvän ystävän kanssa); only the endings differ by gender.",
		ru: "The adjective declines with its noun as in Russian (в новой школе ≈ v novej škole, с хорошим другом ≈ s dobrým kamarátom); the endings are near-cognates.",
		de: "As in der neuen Schule / mit dem guten Freund: the adjective follows the noun's case; v novej škole, s dobrým kamarátom.",
	},
};

export interface UnitBridge {
	lang: BridgeLang;
	/** The language's name, for the label in front of the line. */
	name: string;
	text: string;
}

/** The bridge lines a unit has in the given languages, in the order given
 *  (the learner's own: strongest first). Empty for a words unit or a
 *  learner with none. */
export function unitBridges(unit: UnitId, langs: readonly BridgeLang[]): UnitBridge[] {
	const info = UNITS.find((u) => u.id === unit);
	if (!info) return [];
	const out: UnitBridge[] = [];
	for (const lang of new Set(langs)) {
		if (!BRIDGE_LANGS.includes(lang)) continue;
		const text = lang === "et" ? info.bridge : MORE[unit]?.[lang];
		if (text) out.push({ lang, name: languageName(lang), text });
	}
	return out;
}

/** The units that carry a line in a language (for the tests). */
export function unitsBridgedIn(lang: BridgeLang): UnitId[] {
	return UNITS.filter((u) => (lang === "et" ? !!u.bridge : !!MORE[u.id]?.[lang])).map((u) => u.id);
}
