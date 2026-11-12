/**
 * Methodologies (LangHarness, 2026-11-12) — the core learning methodologies,
 * polyglot frameworks, and language mentors that inform the app's pedagogy.
 *
 * Every methodology lists verified links and academic/video sources.
 * Browser-safe data.
 */

export interface MethodologyPrinciple {
	readonly title: string;
	readonly detail: string;
}

export interface MethodologyTechnique {
	readonly name: string;
	readonly summary: string;
}

export interface MethodologyLink {
	readonly label: string;
	readonly url: string;
}

export interface Methodology {
	readonly id: string;
	readonly name: string;
	readonly title: string;
	readonly origin: string;
	readonly summary: string;
	readonly keyPrinciples: readonly MethodologyPrinciple[];
	readonly signatureTechniques: readonly MethodologyTechnique[];
	readonly appApplication: string;
	readonly quote?: string;
	readonly externalLinks: readonly MethodologyLink[];
}

export const METHODOLOGIES: readonly Methodology[] = [
	{
		id: "machova",
		name: "Dr. Lýdia Machová",
		title: "Language Mentoring & The Lydka Method",
		origin: "Bratislava, Slovakia · Polyglot, Linguist & Conference Interpreter",
		summary:
			"Slovak polyglot who speaks 9 languages, PhD in Translation Studies from Comenius University in Bratislava, and organizer of the Polyglot Gathering in Bratislava. Her framework shows that language acquisition is not an innate talent, but an autonomous self-directed process resting on enjoyment, effective methods, system, and time.",
		quote: "Languages cannot be taught; they can only be learned.",
		keyPrinciples: [
			{
				title: "Enjoyment over drudgery",
				detail:
					"Avoid contrived textbook dialogues about train stations. Learn through content you love (series, podcasts, cooking, fantasy novels) so practice is intrinsically rewarding.",
			},
			{
				title: "Active retrieval & production (L1 → L2)",
				detail:
					"Passive recognition creates an illusion of knowing. You must actively test yourself, producing the target language from meaning, rather than merely recognizing it.",
			},
			{
				title: "System & micro-habits",
				detail:
					"Time is made, not found. Stack 15–20 minute practice sessions into existing daily routines (morning coffee, commute, chores). 30 minutes a day beats 8 hours on a weekend.",
			},
			{
				title: "Overcoming the Timekeeper's Curse",
				detail:
					"Years on a calendar do not equal competence. Measure real, active practice hours and celebrate little victories along the journey.",
			},
		],
		signatureTechniques: [
			{
				name: "Self-talk",
				summary:
					"Speaking out loud to yourself when alone (narrating chores, describing photos, staging imaginary shower arguments) to build speaking fluidity with zero performance anxiety.",
			},
			{
				name: "Back-translation",
				summary:
					"Translating authentic target-language sentences into your bridge language, then translating them back days later and comparing line-by-line with the original native model.",
			},
			{
				name: "Shadowing & chunks",
				summary:
					"Repeating spoken audio out loud in short phrases to train prosody, rhythm, and mouth muscle memory before relying on spelling.",
			},
			{
				name: "The art of simplification",
				summary:
					"Paraphrasing complex thoughts using simple words you already know, rather than freezing when an exact term is missing.",
			},
			{
				name: "85/15 vocabulary rule",
				summary:
					"Devoting 85% of daily vocabulary practice to reviewing older words and only 15% to new acquisitions to defeat the forgetting curve.",
			},
		],
		appApplication:
			"LangHarness applies Machová's principles through retrieval-first practice (Principle P3), context-bound cloze sentences (P4), honest active time tracking with capped idle gaps (P9), authentic YouTube creator input in Watch, and shadowing in Zvuk.",
		externalLinks: [
			{
				label: "Lýdia Machová: The secrets of learning a new language (TED Talk, 2018)",
				url: "https://www.ted.com/talks/lydia_machova_the_secrets_of_learning_a_new_language",
			},
			{
				label: "Lýdia Machová: Ten things polyglots do differently (Polyglot Gathering)",
				url: "https://www.youtube.com/watch?v=ROh_-RG3OVg",
			},
			{
				label: "Language Mentoring / Lydka Method Official Site",
				url: "https://www.languagementoring.com/",
			},
			{
				label: "How to Improve Your Language-Learning Skills Using Self-Talk",
				url: "https://lydkamethod.com/blog/how-to-use-self-talk/",
			},
			{
				label: "Learning Vocabulary: 7 Common Mistakes and How to Avoid Them",
				url: "https://lydkamethod.com/blog/how-to-learn-vocabulary/",
			},
			{
				label: "The Goldlist Method: Learn Vocabulary Without Memorizing",
				url: "https://lydkamethod.com/blog/goldlist-method-how-to-learn-vocabulary/",
			},
		],
	},
	{
		id: "krashen",
		name: "Prof. Stephen Krashen",
		title: "Comprehensible Input & The Natural Approach",
		origin: "United States · University of Southern California",
		summary:
			"Linguist and educational researcher whose input hypothesis posited that humans acquire language when understanding messages slightly beyond their current level (i+1) in a low-anxiety environment.",
		quote: "We acquire language in only one way: when we understand messages; when we receive comprehensible input in a low-anxiety environment.",
		keyPrinciples: [
			{
				title: "Acquisition versus learning",
				detail:
					"Subconscious language acquisition driven by meaningful communication is distinct from conscious rule-learning, which acts primarily as an internal monitor or editor.",
			},
			{
				title: "The Input Hypothesis (i+1)",
				detail:
					"Progress occurs when exposure contains structures just beyond the learner's current competence, rendered understandable through context, intonation, and known vocabulary.",
			},
			{
				title: "The Affective Filter",
				detail:
					"Anxiety, self-consciousness, and low confidence raise an emotional barrier that blocks comprehensible input from reaching the language acquisition device.",
			},
			{
				title: "Reading ahead of production",
				detail:
					"Receptive competence naturally precedes expressive competence. Extensive reading and listening provide the foundation from which spontaneous speech emerges.",
			},
		],
		signatureTechniques: [
			{
				name: "Extensive reading & listening",
				summary:
					"Absorbing high volumes of engaging, level-appropriate stories and audio where at least 95–98% of running words are already understood.",
			},
			{
				name: "Silent period respect",
				summary:
					"Allowing learners to absorb meaning and build internal phonological models before forcing public spoken production.",
			},
		],
		appApplication:
			"LangHarness adopts Krashen's input principles in the Read, Listen, and Watch tasks (graded text at ~97% known words, line-by-line listening), while balancing input with explicit practice and output as argued by Swain and Nation.",
		externalLinks: [
			{
				label: "Stephen Krashen: Principles and Practice in Second Language Acquisition (Full Book)",
				url: "https://www.sdkrashen.com/content/books/principles_and_practice.pdf",
			},
			{
				label: "Stephen Krashen: The Power of Reading (Selected Papers)",
				url: "https://www.sdkrashen.com/",
			},
			{
				label: "Lichtman & VanPatten (2021): Was Krashen right? Forty years later (DOI)",
				url: "https://doi.org/10.1111/flan.12552",
			},
		],
	},
	{
		id: "nation",
		name: "Prof. Paul Nation",
		title: "The Four Strands Framework",
		origin: "Wellington, New Zealand · Victoria University of Wellington",
		summary:
			"Foremost researcher in vocabulary acquisition and curriculum design who formulated the four strands principle: a balanced language program divides time equally between meaning input, meaning output, language study, and fluency development.",
		quote: "A well-balanced language course should consist of four equal strands.",
		keyPrinciples: [
			{
				title: "Meaning-focused input (~25%)",
				detail:
					"Learning through reading and listening where the focus is strictly on understanding messages and unfamiliar items make up no more than 2–5% of the text.",
			},
			{
				title: "Meaning-focused output (~25%)",
				detail:
					"Learning through speaking and writing to convey real messages, forcing syntactic processing and revealing communicative gaps.",
			},
			{
				title: "Language-focused learning (~25%)",
				detail:
					"Deliberate study of grammar patterns, phonology, spelling, and vocabulary via spaced retrieval and corrective feedback.",
			},
			{
				title: "Fluency development (~25%)",
				detail:
					"Operating entirely with familiar vocabulary and grammar under time or parsing pressure (e.g. repeated reading, timed listening, speed drills) to automate access.",
			},
		],
		signatureTechniques: [
			{
				name: "Strand balancing",
				summary:
					"Ensuring no single strand dominates practice; input alone or grammar drills alone fail to build balanced real-world proficiency.",
			},
			{
				name: "4/3/2 activity and repeated reading",
				summary:
					"Repeating the same message with progressively tighter constraints to build procedural fluency.",
			},
		],
		appApplication:
			"LangHarness's core architecture is built directly on Nation's framework (Principle P2). The Today screen schedules one task per strand daily (Read/Listen, Speak, Study, Fluency), and the milestones calculator measures vocabulary coverage and speed separately.",
		externalLinks: [
			{
				label: "Paul Nation (2007): The Four Strands (Innovation in Language Learning and Teaching DOI)",
				url: "https://doi.org/10.2167/illt039.0",
			},
			{
				label: "Paul Nation (2006): How large a vocabulary is needed for reading and listening? (DOI)",
				url: "https://doi.org/10.3138/cmlr.63.1.59",
			},
			{
				label: "Victoria University of Wellington: Paul Nation Publications Archive",
				url: "https://www.wgtn.ac.nz/lals/about/staff/paul-nation",
			},
		],
	},
] as const;

export function methodologyById(id: string): Methodology | undefined {
	return METHODOLOGIES.find((m) => m.id === id);
}
