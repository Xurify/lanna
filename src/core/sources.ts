/**
 * Sources (LangHarness, 2026-11-06) — the research behind every task, in
 * one place the pages can link to. The rule (docs/DECISIONS.md E63): a
 * feature that says it comes from research shows, on its own page, what
 * the research found, what it did not show, and which numbers are the
 * app's own choice. Nothing here is decoration; every entry is one the
 * feature's design or copy leans on.
 *
 * Honesty levels (`checked`):
 *   read   — the abstract was read against the claim made here.
 *   doi    — the DOI resolves (Crossref) to a record with this title and
 *            first author (scripts/check-sources.mjs); not read in full.
 *   listed — cited from our research notes or memory; no link, because
 *            there is no DOI we could confirm. Treat as unchecked.
 *
 * Pure data and lookups. Browser-safe.
 */

export type SourceKind = "meta-analysis" | "experiment" | "study" | "review" | "theory" | "book" | "corpus";
export type SourceChecked = "read" | "doi" | "listed";

export interface Source {
	id: string;
	/** "Lambert, Kormos & Minn 2017" */
	cite: string;
	title: string;
	venue: string;
	year: number;
	doi?: string;
	kind: SourceKind;
	checked: SourceChecked;
	/** What it found, in a line, when we are sure of it. */
	says?: string;
}

const S = (id: string, cite: string, year: number, title: string, venue: string, kind: SourceKind, checked: SourceChecked, doi?: string, says?: string): Source => ({ id, cite, year, title, venue, kind, checked, ...(doi ? { doi } : {}), ...(says ? { says } : {}) });

export const SOURCES: readonly Source[] = [
	// Fluency
	S("nation1989", "Nation 1989", 1989, "Improving speaking fluency", "System 17(3)", "study", "doi", "10.1016/0346-251x(89)90010-9"),
	S("arevart1991", "Arevart & Nation 1991", 1991, "Fluency improvement in a second language", "RELC Journal 22(1)", "experiment", "doi", "10.1177/003368829102200106"),
	S("maurice1983", "Maurice 1983", 1983, "The fluency workshop", "TESOL Newsletter 17(4)", "study", "listed"),
	S("lambert2017", "Lambert, Kormos & Minn 2017", 2017, "Task repetition and second language speech processing", "Studies in Second Language Acquisition 39(1)", "experiment", "read", "10.1017/s0272263116000085", "Repeating the same speaking task changed how learners produced speech."),
	S("dejong2011", "de Jong & Perfetti 2011", 2011, "Fluency training in the ESL classroom: an experimental study of fluency development and proceduralization", "Language Learning 61(2)", "experiment", "read", "10.1111/j.1467-9922.2010.00620.x", "Repeating the same speech raised fluency; the gain was on the repeated content."),
	S("boers2014", "Boers 2014", 2014, "A reappraisal of the 4/3/2 activity", "RELC Journal 45(3)", "study", "read", "10.1177/0033688214546964", "Questions whether the shrinking time limit adds anything: the repetition does the work."),
	S("thai2016", "Thai & Boers 2016", 2016, "Repeating a monologue under increasing time pressure: effects on fluency, complexity, and accuracy", "TESOL Quarterly 50(2)", "experiment", "read", "10.1002/tesq.232", "Repeating gave fluency gains; the tighter time limits did not add to them and could cost accuracy."),
	S("tran2021", "Tran & Saito 2021", 2021, "Effects of the 4/3/2 activity revisited: extending Boers (2014) and Thai & Boers (2016)", "Language Teaching Research", "experiment", "doi", "10.1177/1362168821994136"),
	S("nation2007", "Nation 2007", 2007, "The four strands", "Innovation in Language Learning and Teaching 1(1)", "theory", "doi", "10.2167/illt039.0", "A balanced course gives roughly equal time to meaning-focused input, output, language-focused learning and fluency development."),
	S("chang2010", "Chang 2010", 2010, "The effect of a timed reading activity on EFL learners: speed, comprehension, and perceptions", "Reading in a Foreign Language 22(2)", "experiment", "doi", "10.64152/10125/66837"),
	S("taguchi2004", "Taguchi, Takayasu-Maass & Gorsuch 2004", 2004, "Developing reading fluency in EFL: how assisted repeated reading and extensive reading affect fluency development", "Reading in a Foreign Language 16(2)", "experiment", "doi", "10.64152/10125/66783"),
	S("samuels1979", "Samuels 1979", 1979, "The method of repeated readings", "The Reading Teacher 32(4)", "study", "listed"),
	// Retrieval, spacing, difficulty
	S("roediger2006", "Roediger & Karpicke 2006", 2006, "Test-enhanced learning", "Psychological Science 17(3)", "experiment", "doi", "10.1111/j.1467-9280.2006.01693.x", "Being tested on material beat re-reading it for recall a week later."),
	S("karpicke2008", "Karpicke & Roediger 2008", 2008, "The critical importance of retrieval for learning", "Science 319", "experiment", "doi", "10.1126/science.1152408"),
	S("rowland2014", "Rowland 2014", 2014, "The effect of testing versus restudy on retention: a meta-analytic review of the testing effect", "Psychological Bulletin 140(6)", "meta-analysis", "doi", "10.1037/a0037559", "Retrieval practice beat restudying across the studies pooled."),
	S("dunlosky2013", "Dunlosky et al. 2013", 2013, "Improving students' learning with effective learning techniques", "Psychological Science in the Public Interest 14(1)", "review", "doi", "10.1177/1529100612453266", "Practice testing and spaced practice were the two techniques rated highest in utility."),
	S("kornell2009", "Kornell, Hays & Bjork 2009", 2009, "Unsuccessful retrieval attempts enhance subsequent learning", "Journal of Experimental Psychology: Learning, Memory, and Cognition 35(4)", "experiment", "doi", "10.1037/a0015729"),
	S("richland2009", "Richland, Kornell & Kao 2009", 2009, "The pretesting effect: do unsuccessful retrieval attempts enhance learning?", "Journal of Experimental Psychology: Applied 15(3)", "experiment", "doi", "10.1037/a0016496"),
	S("cepeda2006", "Cepeda et al. 2006", 2006, "Distributed practice in verbal recall tasks: a review and quantitative synthesis", "Psychological Bulletin 132(3)", "meta-analysis", "doi", "10.1037/0033-2909.132.3.354", "317 experiments in 184 articles, nearly all lab verbal recall: spreading practice out beat massing it."),
	S("kim2022", "Kim & Webb 2022", 2022, "The effects of spaced practice on second language learning: a meta-analysis", "Language Learning 72(1)", "meta-analysis", "doi", "10.1111/lang.12479"),
	S("bahrick1993", "Bahrick et al. 1993", 1993, "Maintenance of foreign language vocabulary and the spacing effect", "Psychological Science 4(5)", "experiment", "doi", "10.1111/j.1467-9280.1993.tb00571.x"),
	S("pimsleur1967", "Pimsleur 1967", 1967, "A memory schedule", "The Modern Language Journal 51(2)", "theory", "doi", "10.1111/j.1540-4781.1967.tb06700.x"),
	S("ye2022", "Ye et al. 2022", 2022, "A stochastic shortest path algorithm for optimizing spaced repetition scheduling", "KDD '22", "study", "doi", "10.1145/3534678.3539081", "From the group behind the FSRS scheduler; FSRS itself is a community model benchmarked by its authors."),
	S("brunmair2019", "Brunmair & Richter 2019", 2019, "Similarity matters: a meta-analysis of interleaved learning and its moderators", "Psychological Bulletin 145(11)", "meta-analysis", "doi", "10.1037/bul0000209", "Interleaving helps for some material (paintings, some maths) and was not found to help for word learning."),
	S("nakata2019", "Nakata & Suzuki 2019", 2019, "Mixing grammar exercises facilitates long-term retention: effects of blocking, interleaving, and increasing practice", "The Modern Language Journal 103(3)", "experiment", "doi", "10.1111/modl.12581"),
	S("pan2019", "Pan et al. 2019", 2019, "Does interleaved practice enhance foreign language learning? The effects of training schedule on Spanish verb conjugation skills", "Journal of Educational Psychology 111(7)", "experiment", "doi", "10.1037/edu0000336"),
	S("kornell2008", "Kornell & Bjork 2008", 2008, "Learning concepts and categories: is spacing the \"enemy of induction\"?", "Psychological Science 19(6)", "experiment", "doi", "10.1111/j.1467-9280.2008.02127.x"),
	S("soderstrom2015", "Soderstrom & Bjork 2015", 2015, "Learning versus performance: an integrative review", "Perspectives on Psychological Science 10(2)", "review", "doi", "10.1177/1745691615569000"),
	S("norris2000", "Norris & Ortega 2000", 2000, "Effectiveness of L2 instruction: a research synthesis and quantitative meta-analysis", "Language Learning 50(3)", "meta-analysis", "doi", "10.1111/0023-8333.00136", "Explicit instruction with practice outperformed exposure alone in L2 studies."),
	S("aleven2006", "Aleven et al. 2006", 2006, "Toward meta-cognitive tutoring: a model of help seeking with a cognitive tutor", "International Journal of Artificial Intelligence in Education 16(2)", "study", "doi", "10.3233/irg-2006-16(2)02"),
	S("baker2004", "Baker, Corbett & Koedinger 2004", 2004, "Detecting student misuse of intelligent tutoring systems", "Intelligent Tutoring Systems (LNCS 3220)", "study", "doi", "10.1007/978-3-540-30139-4_50"),
	S("metcalfe2017", "Metcalfe 2017", 2017, "Learning from errors", "Annual Review of Psychology 68", "review", "doi", "10.1146/annurev-psych-010416-044022"),
	S("butterfield2001", "Butterfield & Metcalfe 2001", 2001, "Errors committed with high confidence are hypercorrected", "Journal of Experimental Psychology: Learning, Memory, and Cognition 27(6)", "experiment", "doi", "10.1037/0278-7393.27.6.1491"),
	S("laufer1988", "Laufer 1988", 1988, "The concept of 'synforms' (similar lexical forms) in vocabulary acquisition", "Language and Education 2(2)", "study", "doi", "10.1080/09500788809541228"),
	S("waring1997", "Waring 1997", 1997, "The negative effects of learning words in semantic sets: a replication", "System 25(2)", "experiment", "doi", "10.1016/s0346-251x(97)00013-4"),
	S("tinkham1993", "Tinkham 1993", 1993, "The effect of semantic clustering on the learning of second language vocabulary", "System 21(3)", "experiment", "doi", "10.1016/0346-251x(93)90027-e"),
	S("corder1967", "Corder 1967", 1967, "The significance of learners' errors", "IRAL 5(4)", "theory", "doi", "10.1515/iral.1967.5.1-4.161"),
	// Input, reading, listening, watching
	S("hu2000", "Hu & Nation 2000", 2000, "Unknown vocabulary density and reading comprehension", "Reading in a Foreign Language 13(1)", "experiment", "doi", "10.64152/10125/66973", "Adequate unassisted comprehension needed about 98% of the running words known."),
	S("schmitt2011", "Schmitt, Jiang & Grabe 2011", 2011, "The percentage of words known in a text and reading comprehension", "The Modern Language Journal 95(1)", "study", "doi", "10.1111/j.1540-4781.2011.01146.x", "Comprehension rose steadily with the share of words known; there was no sharp threshold."),
	S("laufer2010", "Laufer & Ravenhorst-Kalovski 2010", 2010, "Lexical threshold revisited: lexical text coverage, learners' vocabulary size and reading comprehension", "Reading in a Foreign Language 22(1)", "study", "doi", "10.64152/10125/66648", "95% coverage as a minimum for reading, 98% as the optimum."),
	S("nation2006", "Nation 2006", 2006, "How large a vocabulary is needed for reading and listening?", "The Canadian Modern Language Review 63(1)", "corpus", "doi", "10.3138/cmlr.63.1.59"),
	S("nakanishi2015", "Nakanishi 2015", 2015, "A meta-analysis of extensive reading research", "TESOL Quarterly 49(1)", "meta-analysis", "doi", "10.1002/tesq.157"),
	S("jeon2016", "Jeon & Day 2016", 2016, "The effectiveness of ER on reading proficiency: a meta-analysis", "Reading in a Foreign Language 28(2)", "meta-analysis", "doi", "10.64152/10125/66901"),
	S("webb2012", "Webb & Chang 2012", 2012, "Vocabulary learning through assisted and unassisted repeated reading", "The Canadian Modern Language Review 68(3)", "experiment", "doi", "10.3138/cmlr.1204.1"),
	S("krashen1982", "Krashen 1982", 1982, "Principles and practice in second language acquisition", "Pergamon", "book", "listed"),
	S("lichtman2021", "Lichtman & VanPatten 2021", 2021, "Was Krashen right? Forty years later", "Foreign Language Annals 54(2)", "review", "doi", "10.1111/flan.12552"),
	S("vanzeeland2013", "van Zeeland & Schmitt 2013", 2013, "Lexical coverage in L1 and L2 listening comprehension: the same or different from reading comprehension?", "Applied Linguistics 34(4)", "study", "doi", "10.1093/applin/ams074"),
	S("staehr2009", "Stæhr 2009", 2009, "Vocabulary knowledge and advanced listening comprehension in English as a foreign language", "Studies in Second Language Acquisition 31(4)", "study", "doi", "10.1017/s0272263109990039"),
	S("goh2000", "Goh 2000", 2000, "A cognitive perspective on language learners' listening comprehension problems", "System 28(1)", "study", "doi", "10.1016/s0346-251x(99)00060-3"),
	S("adolphs2003", "Adolphs & Schmitt 2003", 2003, "Lexical coverage of spoken discourse", "Applied Linguistics 24(4)", "corpus", "doi", "10.1093/applin/24.4.425"),
	S("webb2009tv", "Webb & Rodgers 2009a", 2009, "The vocabulary demands of television programs", "Language Learning 59(2)", "corpus", "doi", "10.1111/j.1467-9922.2009.00509.x"),
	S("webb2009film", "Webb & Rodgers 2009b", 2009, "The lexical coverage of movies", "Applied Linguistics 30(3)", "corpus", "doi", "10.1093/applin/amp010"),
	S("peters2018", "Peters & Webb 2018", 2018, "Incidental vocabulary acquisition through viewing L2 television and factors that affect learning", "Studies in Second Language Acquisition 40(3)", "experiment", "doi", "10.1017/s0272263117000407"),
	// Before listening: topic preparation, advance organizers, pre-taught words
	S("chang2006", "Chang & Read 2006", 2006, "The effects of listening support on the listening performance of EFL learners", "TESOL Quarterly 40(2)", "experiment", "doi", "10.2307/40264527", "Telling learners what the passage was about helped most, hearing it twice next; teaching its words first helped least, and the weaker listeners gained most from the topic."),
	S("herron1994", "Herron 1994", 1994, "An investigation of the effectiveness of using an advance organizer to introduce video in the foreign language classroom", "The Modern Language Journal 78(2)", "experiment", "doi", "10.1111/j.1540-4781.1994.tb02032.x"),
	S("herron1998", "Herron, Cole, York & Linden 1998", 1998, "A comparison study of student retention of foreign language video: declarative versus interrogative advance organizer", "The Modern Language Journal 82(2)", "experiment", "doi", "10.1111/j.1540-4781.1998.tb01197.x"),
	S("chung1999", "Chung 1999", 1999, "The effects of using video texts supported with advance organizers and captions on Chinese college students' listening comprehension: an empirical study", "Foreign Language Annals 32(3)", "experiment", "doi", "10.1111/j.1944-9720.1999.tb01342.x"),
	S("vandergrift2010", "Vandergrift & Tafaghodtari 2010", 2010, "Teaching L2 learners how to listen does make a difference: an empirical study", "Language Learning 60(2)", "experiment", "doi", "10.1111/j.1467-9922.2009.00559.x"),
	S("tegge2017", "Tegge 2017", 2017, "The lexical coverage of popular songs in English language teaching", "System 67", "corpus", "doi", "10.1016/j.system.2017.04.016"),
	S("tauroza1990", "Tauroza & Allison 1990", 1990, "Speech rates in British English", "Applied Linguistics 11(1)", "corpus", "doi", "10.1093/applin/11.1.90"),
	S("segalowitz2010", "Segalowitz 2010", 2010, "Cognitive bases of second language fluency", "Routledge", "book", "doi", "10.4324/9780203851357"),
	S("dekeyser1997", "DeKeyser 1997", 1997, "Beyond explicit rule learning: automatizing second language morphosyntax", "Studies in Second Language Acquisition 19(2)", "experiment", "doi", "10.1017/s0272263197002040"),
	// Speaking and pronunciation
	S("swain1985", "Swain 1985", 1985, "Communicative competence: some roles of comprehensible input and comprehensible output in its development", "In Gass & Madden (eds), Input in second language acquisition", "theory", "listed"),
	S("lyster1997", "Lyster & Ranta 1997", 1997, "Corrective feedback and learner uptake: negotiation of form in communicative classrooms", "Studies in Second Language Acquisition 19(1)", "study", "doi", "10.1017/s0272263197001034"),
	S("lyster2010", "Lyster & Saito 2010", 2010, "Oral feedback in classroom SLA: a meta-analysis", "Studies in Second Language Acquisition 32(2)", "meta-analysis", "doi", "10.1017/s0272263109990520"),
	S("saito2017", "Saito, Trofimovich & Isaacs 2017", 2017, "Using listener judgments to investigate linguistic influences on L2 comprehensibility and accentedness", "Applied Linguistics 38(4)", "study", "doi", "10.1093/applin/amv047"),
	S("derwing2005", "Derwing & Munro 2005", 2005, "Second language accent and pronunciation teaching: a research-based approach", "TESOL Quarterly 39(3)", "review", "doi", "10.2307/3588486", "Argues for intelligibility and comprehensibility, not a native accent, as the goal."),
	// Phonological acquisition and perception
	S("logan1991", "Logan, Lively & Pisoni 1991", 1991, "Training Japanese listeners to identify English /r/ and /l/: a first report", "The Journal of the Acoustical Society of America 89(2)", "experiment", "doi", "10.1121/1.1894649", "High-variability phonetic training across multiple talkers improved non-native phoneme identification."),
	S("bradlow1997", "Bradlow et al. 1997", 1997, "Training Japanese listeners to identify English /r/ and /l/: IV. Some effects of perceptual learning on speech production", "The Journal of the Acoustical Society of America 101(4)", "experiment", "doi", "10.1121/1.418276", "Auditory perceptual training spontaneously transferred to spoken production without articulatory training."),
	S("munro2006", "Munro & Derwing 2006", 2006, "The functional load principle in ESL pronunciation instruction: an exploratory study", "System 34(4)", "study", "doi", "10.1016/j.system.2006.09.004", "Instruction targeting high-functional-load contrasts produced greater gains in listener-rated comprehensibility."),
	S("flege1995", "Flege 1995", 1995, "Second language speech learning: theory, findings, and problems", "In Strange (ed), Speech perception and linguistic experience", "theory", "listed", undefined, "L2 sounds similar to L1 categories are assimilated into native representations unless acoustic variability forces a new category."),
	S("best1995", "Best 1995", 1995, "A direct realist view of cross-language speech perception", "In Strange (ed), Speech perception and linguistic experience", "theory", "listed", undefined, "The Perceptual Assimilation Model: non-native contrasts mapping to a single native category suffer poorest discrimination."),
	S("dupoux2001", "Dupoux et al. 2001", 2001, "A robust method to study stress 'deafness'", "The Journal of the Acoustical Society of America 110(3)", "experiment", "doi", "10.1121/1.1380437", "Speakers of a language with fixed stress (French) had trouble telling words apart by stress alone."),
	S("dupoux2008", "Dupoux et al. 2008", 2008, "Persistent stress 'deafness': the case of French learners of Spanish", "Cognition 106(2)", "experiment", "doi", "10.1016/j.cognition.2007.04.001", "The difficulty stayed even in advanced French learners of Spanish."),
	S("hanulikova2010", "Hanulíková & Hamann 2010", 2010, "Slovak", "Journal of the International Phonetic Association 40(3)", "study", "doi", "10.1017/s0025100310000162", "A description of the sounds of standard Slovak: short and long vowels, diphthongs, syllabic r and l, and stress on the first syllable."),
	// Placement and vocabulary size
	S("meara1987", "Meara & Buxton 1987", 1987, "An alternative to multiple choice vocabulary tests", "Language Testing 4(2)", "study", "doi", "10.1177/026553228700400202"),
	S("huibregtse2002", "Huibregtse, Admiraal & Meara 2002", 2002, "Scores on a yes-no vocabulary test: correction for guessing and response style", "Language Testing 19(3)", "study", "doi", "10.1191/0265532202lt229oa"),
	S("mochida2006", "Mochida & Harrington 2006", 2006, "The yes/no test as a measure of receptive vocabulary knowledge", "Language Testing 23(1)", "study", "doi", "10.1191/0265532206lt321oa"),
	S("pellicer2012", "Pellicer-Sánchez & Schmitt 2012", 2012, "Scoring yes-no vocabulary tests: reaction time vs. nonword approaches", "Language Testing 29(4)", "study", "doi", "10.1177/0265532212438053"),
	S("milton2009", "Milton 2009", 2009, "Measuring second language vocabulary acquisition", "Multilingual Matters", "book", "listed"),
	S("cefr2001", "Council of Europe 2001", 2001, "Common European Framework of Reference for Languages", "Cambridge University Press", "book", "listed"),
	S("brezina2015", "Brezina & Gablasova 2015", 2015, "Is there a core general vocabulary? Introducing the New General Service List", "Applied Linguistics 36(1)", "corpus", "doi", "10.1093/applin/amt018"),
	S("ringbom2007", "Ringbom 2007", 2007, "Cross-linguistic similarity in foreign language learning", "Multilingual Matters", "book", "doi", "10.21832/9781853599361", "Related languages give a learning head start; the book gives no hours."),
	// Motivation, habit, framing
	S("lally2010", "Lally et al. 2010", 2010, "How are habits formed: modelling habit formation in the real world", "European Journal of Social Psychology 40(6)", "study", "doi", "10.1002/ejsp.674", "Simple daily actions took a median of 66 days to reach the person's own plateau of automaticity (range 18 to 254); one missed day did not materially hurt."),
	S("wood2016", "Wood & Rünger 2016", 2016, "Psychology of habit", "Annual Review of Psychology 67", "review", "doi", "10.1146/annurev-psych-122414-033417"),
	S("gollwitzer2006", "Gollwitzer & Sheeran 2006", 2006, "Implementation intentions and goal achievement: a meta-analysis of effects and processes", "Advances in Experimental Social Psychology 38", "meta-analysis", "doi", "10.1016/s0065-2601(06)38002-1"),
	S("sailer2020", "Sailer & Homner 2020", 2020, "The gamification of learning: a meta-analysis", "Educational Psychology Review 32", "meta-analysis", "doi", "10.1007/s10648-019-09498-w"),
	S("hamari2017", "Hamari 2017", 2017, "Do badges increase user activity? A field experiment on the effects of gamification", "Computers in Human Behavior 71", "experiment", "doi", "10.1016/j.chb.2015.03.036"),
	S("mekler2017", "Mekler et al. 2017", 2017, "Towards understanding the effects of individual gamification elements on intrinsic motivation and performance", "Computers in Human Behavior 71", "experiment", "doi", "10.1016/j.chb.2015.08.048"),
	S("hanus2015", "Hanus & Fox 2015", 2015, "Assessing the effects of gamification in the classroom: a longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance", "Computers & Education 80", "study", "doi", "10.1016/j.compedu.2014.08.019"),
	S("deci1999", "Deci, Koestner & Ryan 1999", 1999, "A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation", "Psychological Bulletin 125(6)", "meta-analysis", "doi", "10.1037/0033-2909.125.6.627"),
	S("abramovich2013", "Abramovich, Schunn & Higashi 2013", 2013, "Are badges useful in education? It depends upon the type of badge and expertise of learner", "Educational Technology Research and Development 61(2)", "study", "doi", "10.1007/s11423-013-9289-2"),
	S("bai2020", "Bai, Hew & Huang 2020", 2020, "Does gamification improve student learning outcome? Evidence from a meta-analysis and synthesis of qualitative data", "Educational Research Review 30", "meta-analysis", "doi", "10.1016/j.edurev.2020.100322"),
	S("kivetz2006", "Kivetz, Urminsky & Zheng 2006", 2006, "The goal-gradient hypothesis resurrected", "Journal of Marketing Research 43(1)", "study", "doi", "10.1509/jmkr.43.1.39"),
	S("nunes2006", "Nunes & Drèze 2006", 2006, "The endowed progress effect: how artificial advancement increases effort", "Journal of Consumer Research 32(4)", "experiment", "doi", "10.1086/500480"),
	S("dai2014", "Dai, Milkman & Riis 2014", 2014, "The fresh start effect: temporal landmarks motivate aspirational behavior", "Management Science 60(10)", "study", "doi", "10.1287/mnsc.2014.1901", "About calendar landmarks such as new weeks, months and birthdays."),
	S("locke2002", "Locke & Latham 2002", 2002, "Building a practically useful theory of goal setting and task motivation: a 35-year odyssey", "American Psychologist 57(9)", "review", "doi", "10.1037/0003-066x.57.9.705"),
	S("toda2018", "Toda, Valle & Isotani 2018", 2018, "The dark side of gamification: an overview of negative effects of gamification in education", "CCIS 832", "review", "doi", "10.1007/978-3-319-97934-2_9"),
	S("loewenstein1994", "Loewenstein 1994", 1994, "The psychology of curiosity: a review and reinterpretation", "Psychological Bulletin 116(1)", "theory", "doi", "10.1037/0033-2909.116.1.75"),
	S("kang2009", "Kang et al. 2009", 2009, "The wick in the candle of learning", "Psychological Science 20(8)", "experiment", "doi", "10.1111/j.1467-9280.2009.02402.x", "Curiosity about trivia questions was followed by better memory for their answers."),
	S("gruber2014", "Gruber, Gelman & Ranganath 2014", 2014, "States of curiosity modulate hippocampus-dependent learning via the dopaminergic circuit", "Neuron 84(2)", "experiment", "doi", "10.1016/j.neuron.2014.08.060"),
	S("wilson1982", "Wilson & Linville 1982", 1982, "Improving the academic performance of college freshmen: attribution therapy revisited", "Journal of Personality and Social Psychology 42(2)", "experiment", "doi", "10.1037/0022-3514.42.2.367"),
	S("walton2011", "Walton & Cohen 2011", 2011, "A brief social-belonging intervention improves academic and health outcomes of minority students", "Science 331(6023)", "experiment", "doi", "10.1126/science.1198364"),
	S("yeager2016", "Yeager et al. 2016", 2016, "Using design thinking to improve psychological interventions: the case of the growth mindset during the transition to high school", "Journal of Educational Psychology 108(3)", "experiment", "doi", "10.1037/edu0000098"),
	S("sisk2018", "Sisk et al. 2018", 2018, "To what extent and under which circumstances are growth mind-sets important to academic achievement? Two meta-analyses", "Psychological Science 29(4)", "meta-analysis", "doi", "10.1177/0956797617739704", "Growth-mindset effects on achievement were small."),
	S("dornyei2009", "Dörnyei 2009", 2009, "The L2 motivational self system", "In Dörnyei & Ushioda (eds), Motivation, language identity and the L2 self", "theory", "doi", "10.21832/9781847691293-003"),
	S("magid2012", "Magid & Chan 2012", 2012, "Motivating English learners by helping them visualise their ideal L2 self: lessons from two motivational programmes", "Innovation in Language Learning and Teaching 6(2)", "study", "doi", "10.1080/17501229.2011.614693"),
	S("alhoorie2018", "Al-Hoorie 2018", 2018, "The L2 motivational self system: a meta-analysis", "Studies in Second Language Learning and Teaching 8(4)", "meta-analysis", "doi", "10.14746/ssllt.2018.8.4.2", "The ideal L2 self correlates with motivation; its link to achievement is weak."),
	S("hershfield2011", "Hershfield et al. 2011", 2011, "Increasing saving behavior through age-progressed renderings of the future self", "Journal of Marketing Research 48", "experiment", "doi", "10.1509/jmkr.48.spl.s23"),
	S("oettingen2002", "Oettingen & Mayer 2002", 2002, "The motivating function of thinking about the future: expectations versus fantasies", "Journal of Personality and Social Psychology 83(5)", "study", "doi", "10.1037/0022-3514.83.5.1198"),
	// Listening outside the app
	S("toro2005", "Toro, Sinnett & Soto-Faraco 2005", 2005, "Speech segmentation by statistical learning depends on attention", "Cognition 97(2)", "experiment", "doi", "10.1016/j.cognition.2005.01.006", "Adults found the words in a stream of artificial speech when they only listened; a task done at the same time impaired it dramatically."),
	S("kuhl2003", "Kuhl, Tsao & Liu 2003", 2003, "Foreign-language experience in infancy: effects of short-term exposure and social interaction on phonetic learning", "PNAS 100(15)", "experiment", "doi", "10.1073/pnas.1532872100", "Infants learned Mandarin sounds from live tutors, not from the same sessions on video or audio."),
	S("craik1996", "Craik et al. 1996", 1996, "The effects of divided attention on encoding and retrieval processes in human memory", "Journal of Experimental Psychology: General 125(2)", "experiment", "doi", "10.1037/0096-3445.125.2.159", "Dividing attention while taking words in cut later memory by a large margin."),
	S("wright2010", "Wright et al. 2010", 2010, "Enhancing perceptual learning by combining practice with periods of additional sensory stimulation", "Journal of Neuroscience 30(38)", "experiment", "doi", "10.1523/jneurosci.0487-10.2010", "Extra exposure to a sound helped discrimination learning only when it came close to active practice."),
	S("alexander2023", "Alexander, Van Hedger & Batterink 2023", 2023, "Learning words without trying: daily second language podcasts support word-form learning in adults", "Psychonomic Bulletin & Review 30(2)", "experiment", "doi", "10.3758/s13423-022-02190-1", "Two weeks of Italian podcasts in daily routines improved telling Italian words from non-words; meanings were not tested."),
	S("parry2021", "Parry et al. 2021", 2021, "A systematic review and meta-analysis of discrepancies between logged and self-reported digital media use", "Nature Human Behaviour 5", "meta-analysis", "doi", "10.1038/s41562-021-01117-5", "Self-reported media time correlated with logged time at about r = 0.38, with errors in both directions."),
];

// ─── The features ───────────────────────────────────────────────────────────

interface Feature {
	id: string;
	title: string;
	route: string;
	/** What the research found, in plain words. */
	evidence: string;
	/** What it did not show, or where the app goes past it. */
	limits: string;
	/** The numbers and rules that are the app's own choice. */
	ours: string;
	/** Source ids, most important first. */
	sources: readonly string[];
}

export const FEATURES: readonly Feature[] = [
	{
		id: "speed-fast",
		title: "Speed",
		route: "/speed",
		evidence: "Saying the same lines again is the idea behind the 4/3/2 technique (Maurice 1983; Nation 1989), and repeating the same speaking task raised fluency in experiments (de Jong & Perfetti 2011; Lambert, Kormos & Minn 2017; Thai & Boers 2016).",
		limits: "What the studies support is the repetition. The shrinking time window is our design on top of it, kept on purpose: Boers (2014) and Thai & Boers (2016) found tighter time limits did not add fluency and could cost accuracy, which is why a spoken pass counts only if it was also clear. The gains are on the repeated content; nothing here shows you get quicker on new sentences.",
		ours: "Three windows (1.6, 1.25 and 1 times the base time), six sentences a round, the 70 points needed to count as clear, and the XP.",
		sources: ["lambert2017", "dejong2011", "thai2016", "boers2014", "nation1989", "arevart1991", "tran2021", "maurice1983", "nation2007"],
	},
	{
		id: "speed-reread",
		title: "Read it faster",
		route: "/speed?mode=reread",
		evidence: "Timed re-reading of easy text, with a record of words a minute and a comprehension check, raised reading speed in EFL studies (Chang 2010; Taguchi, Takayasu-Maass & Gorsuch 2004). Re-reading something already understood is how Nation's fourth strand is practiced.",
		limits: "The studies show gains on the practiced texts; whether speed carries to new texts is less settled. The question is there so speed never costs understanding, and the speed bonus is paid only when it is right.",
		ours: "The first target per level is a guess; after that the bar is the middle of your last three paces. Speeds above 450 words a minute are treated as skimming.",
		sources: ["chang2010", "taguchi2004", "samuels1979", "nation2007", "webb2012"],
	},
	{
		id: "lesson",
		title: "Lessons",
		route: "/lesson",
		evidence: "Answering from memory beats looking at the answer again (Roediger & Karpicke 2006; Rowland 2014; Dunlosky et al. 2013), and a try that fails, followed by the answer, still helps (Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009). Practice that feels harder in the moment can teach more than practice that feels smooth (Soderstrom & Bjork 2015). Explicit teaching with practice beat exposure alone in L2 studies (Norris & Ortega 2000).",
		limits: "Mixing similar items helps some material (Nakata & Suzuki 2019) but not reliably words (Brunmair & Richter 2019), and the one study on L2 verb forms is not a clean win (Pan et al. 2019). Research on paying for hints comes from maths tutors (Aleven et al. 2006; Baker et al. 2004), not language drills, and a price in XP only matters if you care about XP.",
		ours: "Twelve reps, three lessons at 80% to finish a unit, 95% to test out, and how many reps from neighboring units get mixed in.",
		sources: ["roediger2006", "karpicke2008", "rowland2014", "soderstrom2015", "dunlosky2013", "kornell2009", "richland2009", "norris2000", "nakata2019", "brunmair2019", "pan2019", "aleven2006", "baker2004"],
	},
	{
		id: "review",
		title: "Review",
		route: "/review",
		evidence: "Practice spread over time is remembered longer than practice crammed together, for second-language words too (Cepeda et al. 2006; Bahrick et al. 1993; Kim & Webb 2022), and retrieving beats re-reading (Rowland 2014).",
		limits: "Most of the lab work is word lists. The scheduler (FSRS) is a community model whose own benchmarks come from its authors (Ye et al. 2022 is the paper from the same group); we have not tested it against fixed schedules on your data.",
		ours: "The retention target, the grading rules, and what counts as a word you know.",
		sources: ["cepeda2006", "kim2022", "bahrick1993", "pimsleur1967", "rowland2014", "ye2022"],
	},
	{
		id: "listen",
		title: "Listen",
		route: "/listen",
		evidence: "Understanding speech takes most of the words: about 95% in the listening study (van Zeeland & Schmitt 2013), and listeners often know the words yet cannot parse them at speed (Goh 2000). Typing what you hear makes that gap visible.",
		limits: "The coverage figures come from English. Typing also tests spelling, so a miss can be a spelling miss and not a hearing miss.",
		ours: "Sentences are picked at 93% known words, below the 95% in the study; the typed-correctly score and the trends are the app's own measure.",
		sources: ["vanzeeland2013", "nation2006", "staehr2009", "goh2000", "adolphs2003"],
	},
	{
		id: "cheatsheet-listen",
		title: "Listen to a cheatsheet",
		route: "/listen",
		evidence: "Listeners often know the words yet cannot parse them at speed (Goh 2000). Hearing a passage a second time helped listeners more than being taught its words first (Chang & Read 2006). Typing what you hear shows which of your phrases the ear has, and which you can only read.",
		limits: "Neither study tested dictation of a learner's own phrase list. The second hearing in Chang & Read was the same passage in one sitting, not a phrase that comes back in a later session. Typing also tests spelling, so a miss can be a spelling miss and not a hearing miss. The phrases are yours as written: nothing checks them against the dictionary.",
		ours: "Ten phrases a session: up to five missed ones first, then phrases not heard yet in the sheet's order, then the ones caught the fewest times in a row. A phrase with two forms (\"a / b\") is played as two, and a phrase with … in it is not played, so the count differs from the sheet's. \"Caught by ear\" means the last answer matched the phrase without the text shown. None of it counts toward words known, the listening speed or the listening trends.",
		sources: ["goh2000", "chang2006"],
	},
	{
		id: "read",
		title: "Read",
		route: "/read",
		evidence: "How much of a text you understand rises with the share of words you know: about 95% as a minimum and 98% as the optimum for reading (Laufer & Ravenhorst-Kalovski 2010; Hu & Nation 2000; Schmitt, Jiang & Grabe 2011). Reading a lot at an easy level shows small to medium gains (Nakanishi 2015; Jeon & Day 2016).",
		limits: "These are English studies. Whether a word counts as known in the app is the app's own list, and an episode being 97% known is a target, not a guarantee.",
		ours: "Episodes are written at about 97% known words, the question kinds per level, and the tap-to-gloss help.",
		sources: ["laufer2010", "hu2000", "schmitt2011", "nation2006", "nakanishi2015", "jeon2016", "krashen1982", "lichtman2021"],
	},
	{
		id: "watch",
		title: "Watch",
		route: "/watch",
		evidence: "Films and TV use a lot of rare words (Webb & Rodgers 2009a, 2009b), and viewing in the language can teach words (Peters & Webb 2018). Listening one line at a time with the text hidden is dictation-style practice. Before a hard video, knowing what it is about helped listeners more than learning its words first did, and helped the weaker listeners most (Chang & Read 2006); a short description of what a video will show, given before it, raised comprehension of the video (Herron 1994), statements more than questions (Herron et al. 1998), and with captions more than alone (Chung 1999).",
		limits: "The word counts are English. The coverage and the speed in Milestones for Slovak are estimates built on them. The before-listening studies used short classroom passages and teacher-written introductions, not a model's, and pre-taught words gave only a small gain (Chang & Read 2006); none tested a summary written in the language at the learner's level.",
		ours: "Line-by-line replay, the hidden text, the pre-teach and the coverage score; Get ready's shape (what it is about, the parts, a short version at your level, then the keys typed into their lines), when it is offered first (under 88% known), and the 92% floor the short version is written again under.",
		sources: ["webb2009tv", "webb2009film", "peters2018", "vanzeeland2013", "nation2006", "chang2006", "herron1994", "herron1998", "chung1999", "vandergrift2010"],
	},
	{
		id: "speak",
		title: "Speak",
		route: "/speak",
		evidence: "Producing the language pushes you to notice what you cannot yet say (Swain 1985). In classroom studies, prompting the learner to fix an error worked at least as well as handing over the fix (Lyster & Ranta 1997; Lyster & Saito 2010). The goal in pronunciation is being understood, not a native accent (Derwing & Munro 2005; Saito, Trofimovich & Isaacs 2017).",
		limits: "These are classroom studies with a human teacher and human listeners. The tutor is a model, and the clarity score is a machine's reading of one recording.",
		ours: "The 70 points to count as clear and 85 for a very clear one, the scenes, and the XP.",
		sources: ["swain1985", "lyster1997", "lyster2010", "derwing2005", "saito2017"],
	},
	{
		id: "ear-gym",
		title: "Ear gym",
		route: "/phonology",
		evidence: "Multi-talker minimal-pair discrimination (HVPT) expands non-native perceptual categories and transfers directly to spoken production without motor training (Logan et al. 1991; Bradlow et al. 1997). Prioritizing high-functional-load contrasts accelerates comprehensibility gains (Munro & Derwing 2006; Best 1995; Flege 1995).",
		limits: "HVPT laboratory studies use 4 to 6 real recorded native speakers over several weeks. Our Ear Gym utilizes synthetic voices across genders; synthetic voices carry slightly less natural acoustic variation than human talkers, though multi-voice synthesis maintains variability.",
		ours: "Rounds of ten two-choice trials. Both words stay on screen in the same order, the word played is picked at random, and after each answer each word plays from its tile. A round is practice only and is not saved.",
		sources: ["logan1991", "bradlow1997", "munro2006", "flege1995", "best1995"],
	},
	{
		id: "rhythmic-law",
		title: "Rhythm rule",
		route: "/phonology",
		evidence: "This page describes the language; no study has tested it as training. Standard Slovak tells short and long vowels apart and puts the stress on the first syllable (Hanulíková & Hamann 2010). The rule that two long syllables do not stand side by side, and its exceptions, follow the Slovak grammar reference this app is checked against. Dupoux et al. (2001, 2008) found that speakers of a language with fixed stress have trouble hearing stress that moves; that says nothing about learning Slovak, whose stress does not move, so it is listed for what it does not show.",
		limits: "The checker counts letters, not words it knows: it allows any word that ends in -ia after a long syllable, knows only a short list of the other exceptions, and cannot tell a loanword or a compound, where the rule does not apply.",
		ours: "A word checker that marks each syllable long or short, pairs of forms where the same ending is long after a short stem and short after a long one, and a sentence with the stress marked.",
		sources: ["hanulikova2010", "dupoux2001", "dupoux2008"],
	},
	{
		id: "line",
		title: "Today's line",
		route: "/line",
		evidence: "A question you cannot yet answer, followed by the answer, is remembered better than study alone (Richland, Kornell & Kao 2009; Kornell, Hays & Bjork 2009). Curiosity about a gap held attention and memory in lab trivia studies (Loewenstein 1994; Kang et al. 2009; Gruber, Gelman & Ranganath 2014).",
		limits: "The curiosity studies used trivia questions, not dictation. The second hearing comes after you have seen the sentence, so a higher second count shows memory of what you read, not growth in listening.",
		ours: "One sentence, heard cold and again later, and the history chart.",
		sources: ["richland2009", "kornell2009", "loewenstein1994", "kang2009", "gruber2014"],
	},
	{
		id: "mixups",
		title: "Mix-ups and Catch the mistake",
		route: "/catch",
		evidence: "Errors you notice and correct are a way to learn (Metcalfe 2017), and a confident error is more likely to be fixed once you see the answer (Butterfield & Metcalfe 2001). Words that look or mean nearly the same are harder to learn together (Laufer 1988; Tinkham 1993; Waring 1997), which is why a pair you confuse gets its own drill.",
		limits: "These are lab studies, mostly on trivia and word lists: they make the design plausible, they do not show these drills work. Mixing exercise types helps some material and not all (Kornell & Bjork 2008; Nakata & Suzuki 2019). The mix-up record is the app's own count of your first tries.",
		ours: "How many mix-ups make a pair, when a pair counts as mended, and the drills built from them.",
		sources: ["metcalfe2017", "butterfield2001", "laufer1988", "tinkham1993", "waring1997", "kornell2008", "nakata2019", "corder1967"],
	},
	{
		id: "placement",
		title: "Level check",
		route: "/start",
		evidence: "A short yes/no check of word knowledge, with made-up words to catch guessing, estimates vocabulary size quickly (Meara & Buxton 1987; Huibregtse, Admiraal & Meara 2002; Mochida & Harrington 2006).",
		limits: "It is rough: few items per band, so the size comes with a wide error, and the made-up words give only a coarse correction. It tests written recognition, not listening. The grammar ladder stops at B1.",
		ours: "Forty words in five bands, the 75% pass share, and the tier-to-level labels.",
		sources: ["meara1987", "huibregtse2002", "mochida2006", "pellicer2012", "milton2009", "cefr2001"],
	},
	{
		id: "plan",
		title: "The daily plan and the four strands",
		route: "/",
		evidence: "A balanced course gives about equal time to meaning-focused input, output, language-focused study and fluency work (Nation 2007). Short daily practice, spread out, beats long sessions (Cepeda et al. 2006; Kim & Webb 2022).",
		limits: "The quarter each is a planning guideline for classroom courses, not a tested optimum. A real day here is about half form-focused study, well over a quarter, and the balance chart shows it.",
		ours: "One task per strand, the minutes assigned to each task, the order they drop out when time is short, and input (a video that waits, else ten more Listen sentences) as the step once the plan is done.",
		sources: ["nation2007", "cepeda2006", "kim2022"],
	},
	{
		id: "outside",
		title: "Listening outside the app",
		route: "/",
		evidence: "Attention is what turns heard speech into words: adults found the words of an artificial language by listening alone, and a task done at the same time impaired it dramatically (Toro, Sinnett & Soto-Faraco 2005); dividing attention while taking words in cuts later memory by a large margin (Craik et al. 1996). Infants learned new sounds from a live tutor and not from the same sessions on video or audio (Kuhl, Tsao & Liu 2003).",
		limits: "No study gives a weight for an hour of focused listening outside a course against an hour of guided study, and none compares attended with background listening in adult learners. Background listening is not worth exactly nothing: two weeks of podcasts in daily routines improved recognizing word forms, though meanings were not tested (Alexander, Van Hedger & Batterink 2023), and passive exposure helped sound learning when it came close to practice (Wright et al. 2010). Minutes you log yourself are imprecise; self-reported media time agrees only loosely with logs, in both directions (Parry et al. 2021).",
		ours: "Focused time counts at half and background time not at all, in a speed date of its own; the measured dates, minutes, XP, streak and strand balance never include it; one entry is at most 600 minutes and a day at most 16 hours.",
		sources: ["toro2005", "craik1996", "kuhl2003", "alexander2023", "wright2010", "parry2021"],
	},
	{
		id: "milestones",
		title: "Milestones",
		route: "/milestones",
		evidence: "How many words you need to follow a kind of speech or text comes from counts of real talk, TV and film (Nation 2006; Adolphs & Schmitt 2003; Webb & Rodgers 2009a, 2009b), together with the 95% to 98% coverage thresholds (Hu & Nation 2000; van Zeeland & Schmitt 2013). Speed work builds automatic processing (Segalowitz 2010), with practice effects that follow a power law (DeKeyser 1997).",
		limits: "The counts are English and the app converts them to Slovak lemmas with its own factor. No source gives words-a-minute figures per CEFR level, so the speed ladder, the support factors, the 150 words a minute for natural speech and the pace-based dates are the app's own estimates, and every date is a range, not a promise.",
		ours: "The lemma factor, the speed ladder, the coverage picked per situation, and the on-track bands.",
		sources: ["nation2006", "adolphs2003", "webb2009tv", "webb2009film", "hu2000", "vanzeeland2013", "laufer2010", "segalowitz2010", "dekeyser1997", "tauroza1990", "tegge2017", "brezina2015"],
	},
	{
		id: "hours",
		title: "Hours to a level",
		route: "/progress",
		evidence: "Related languages give a learning head start (Ringbom 2007), and spaced daily practice is the efficient way to spend minutes (Cepeda et al. 2006; Bahrick et al. 1993).",
		limits: "The hours per level are taken between English-course figures and government course figures (Cambridge English; the US Foreign Service Institute), which are classroom hours, not self-study minutes. The head start in hours is the app's subtraction, not a result from the book.",
		ours: "Every hour figure, the head-start estimate, and the guided hours credited for finished units.",
		sources: ["ringbom2007", "cepeda2006", "bahrick1993", "kim2022"],
	},
	{
		id: "habit",
		title: "Streaks, stamps and the week",
		route: "/progress",
		evidence: "Habits form with repetition in a steady context, over weeks to months, and one missed day did not materially hurt in the habit study (Lally et al. 2010; Wood & Rünger 2016). Plans of the form \"when X, I do Y\" help goals get done (Gollwitzer & Sheeran 2006). Badges tied to a real outcome work better than badges for clicking (Abramovich, Schunn & Higashi 2013).",
		limits: "Points and badges raise activity but can lower interest in the thing itself (Hamari 2017; Mekler et al. 2017; Deci, Koestner & Ryan 1999), and effects shrink over time (Bai, Hew & Huang 2020). Company reports about streaks are correlational. A few stamps count practice done, not only outcomes.",
		ours: "The 42 stamps and their thresholds, the one forgiven rest day a week, and the XP.",
		sources: ["lally2010", "wood2016", "gollwitzer2006", "abramovich2013", "sailer2020", "hamari2017", "mekler2017", "hanus2015", "deci1999", "bai2020", "toda2018", "kivetz2006", "nunes2006", "dai2014", "locke2002"],
	},
	{
		id: "where-you-are",
		title: "Where you are and dated scenes",
		route: "/milestones",
		evidence: "Telling learners that a difficulty comes from something that can change helped college students in small studies (Wilson & Linville 1982), a brief belonging message improved outcomes for minority students at one university (Walton & Cohen 2011), and a picture of your future self in the language is a core idea in L2 motivation (Dörnyei 2009; Magid & Chan 2012; Hershfield et al. 2011).",
		limits: "Effects of these brief interventions were smaller at scale (Yeager et al. 2016; Sisk et al. 2018), the link between an ideal L2 self and achievement is weak (Al-Hoorie 2018), and imagining only the happy outcome can lower effort (Oettingen & Mayer 2002). None of it was tested on adults using an app like this one.",
		ours: "The wording of the limit and the date projection from your last 14 days.",
		sources: ["wilson1982", "walton2011", "yeager2016", "sisk2018", "dornyei2009", "magid2012", "alhoorie2018", "hershfield2011", "oettingen2002"],
	},
];

// ─── Lookups ────────────────────────────────────────────────────────────────

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function sourceById(id: string): Source | undefined {
	return BY_ID.get(id);
}

export function featureById(id: string): Feature | undefined {
	return FEATURES.find((f) => f.id === id);
}

/** The feature's sources, resolved, in the order the feature lists them. */
export function sourcesOf(feature: Feature): Source[] {
	return feature.sources.map((id) => BY_ID.get(id)).filter((s): s is Source => !!s);
}

/** https://doi.org/… for a source with a DOI, else undefined. */
export function sourceUrl(s: Source): string | undefined {
	return s.doi ? `https://doi.org/${s.doi}` : undefined;
}

/** Features that cite a source, for the reference page. */
export function featuresCiting(id: string): Feature[] {
	return FEATURES.filter((f) => f.sources.includes(id));
}
