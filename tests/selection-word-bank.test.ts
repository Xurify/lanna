import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { isEligibleLearningTarget } from "../components/words/selection-word-bank";

describe("SelectionWordBankBar: isEligibleLearningTarget scoping (LingQ & Clozemaster style)", () => {
	const dom = parseHTML(`
		<!DOCTYPE html>
		<html lang="en">
			<body>
				<!-- Dashboard widgets -->
				<main data-testid="today-page">
					<header>
						<h1>Dobrý večer</h1>
					</header>
					<aside>
						<div data-testid="weak-spots">
							<p id="weak-spots-header">Your weak spots</p>
						</div>
					</aside>
				</main>

				<!-- Sidebar navigation -->
				<nav id="app-nav">
					<a href="/words" id="nav-words">Words</a>
				</nav>

				<!-- Lesson Player (Target language exercise) -->
				<!-- 1. Before answering: data-word-lookup-enabled="false" (prevent cheating) -->
				<div id="lesson-screen-unanswered" data-word-lookup-enabled="false">
					<h2 id="lesson-instruction">What does it mean?</h2>
					<!-- Target Slovak sentence -->
					<p id="lesson-sentence-unanswered" class="font-prose text-[30px]" lang="sk">
						Dajme si ďalší!
					</p>
					<button id="btn-choice-1" type="button">1. Let's go have a beer</button>
					<button id="btn-choice-2" type="button">2. Someone is calling</button>
					<button id="btn-choice-3" type="button">3. Let's have another!</button>
				</div>

				<!-- 2. After answering: data-word-lookup-enabled="true" (allow review & word bank) -->
				<div id="lesson-screen-answered" data-word-lookup-enabled="true">
					<p id="lesson-sentence-answered" class="font-prose text-[30px]" lang="sk">
						Dajme si ďalší!
					</p>
					<!-- English translation in lesson -->
					<p id="lesson-translation" class="font-prose text-base text-muted-foreground" lang="en">
						Let's have another!
					</p>
					<!-- Action buttons -->
					<button id="btn-continue" type="button">Continue</button>
					<button id="btn-leave" type="button" aria-label="Leave lesson">X</button>
				</div>

				<!-- Reader (Reading story) -->
				<article id="reader-story" data-word-lookup-enabled="true">
					<p id="reader-para" lang="sk">Kto riskuje, ten získa.</p>
					<p id="reader-en-trans" lang="en">Who dares, wins.</p>
				</article>

				<!-- Watch subtitles -->
				<div data-word-column data-word-lookup-enabled="true" id="watch-subs">
					<span id="sub-line">Dnes máme krásny deň.</span>
				</div>

				<!-- AI Tutor message -->
				<div class="lanna-source-passage" id="tutor-passage">
					<span id="tutor-text">Vitajte! Máte nejaké otázky o slovenčine?</span>
				</div>

				<!-- Saved phrase card in Word Bank -->
				<div class="phrase-card">
					<p id="saved-phrase-sk" lang="sk" data-word-lookup-enabled="true">Dnes máme krásny deň v Bratislave.</p>
					<p id="saved-phrase-en" lang="en">Today we have a beautiful day in Bratislava.</p>
				</div>

				<!-- Reading comprehension quiz: unanswered vs answered -->
				<div id="read-check-unanswered" data-word-lookup-enabled="false">
					<h2 id="read-check-q-unanswered" lang="sk">Čo hľadá Martin v meste?</h2>
				</div>
				<div id="read-check-answered" data-word-lookup-enabled="true">
					<h2 id="read-check-q-answered" lang="sk">Čo hľadá Martin v meste?</h2>
				</div>

				<!-- Placement test: stage 1 unanswered vs answered -->
				<form id="placement-unanswered" data-word-lookup-enabled="false">
					<p id="placement-sentence-unanswered" lang="sk">Idem do obchodu kúpiť chlieb.</p>
				</form>
				<form id="placement-answered" data-word-lookup-enabled="true">
					<p id="placement-sentence-answered" lang="sk">Idem do obchodu kúpiť chlieb.</p>
				</form>

				<!-- Speak dialogue: past spoken turns vs active options -->
				<ol id="speak-turns" data-word-lookup-enabled="true">
					<li id="speak-past-line" lang="sk">Ahoj, ako sa dnes máš?</li>
				</ol>
				<div id="speak-options" data-word-lookup-enabled="false">
					<button id="speak-choice-1"><span lang="sk">Mám sa dobre, ďakujem!</span></button>
				</div>
			</body>
		</html>
	`);

	const { document } = dom;

	it("strictly rejects English dashboard chrome and headers ('Your weak spots', 'Dobrý večer')", () => {
		const weakSpotsText = document.getElementById("weak-spots-header")?.firstChild;
		assert.equal(isEligibleLearningTarget(weakSpotsText, "sk"), false);

		const greetingText = document.querySelector("h1")?.firstChild;
		assert.equal(isEligibleLearningTarget(greetingText, "sk"), false);
	});

	it("strictly rejects sidebar navigation links", () => {
		const navWords = document.getElementById("nav-words")?.firstChild;
		assert.equal(isEligibleLearningTarget(navWords, "sk"), false);
	});

	it("strictly rejects interactive buttons and controls (Continue, Leave, Choices)", () => {
		const btnContinue = document.getElementById("btn-continue")?.firstChild;
		assert.equal(isEligibleLearningTarget(btnContinue, "sk"), false);

		const btnLeave = document.getElementById("btn-leave")?.firstChild;
		assert.equal(isEligibleLearningTarget(btnLeave, "sk"), false);

		const btnChoice = document.getElementById("btn-choice-1")?.firstChild;
		assert.equal(isEligibleLearningTarget(btnChoice, "sk"), false);
	});

	it("PREVENTS CHEATING: strictly rejects word lookup during active exercise before answering", () => {
		const unansweredSentence = document.getElementById("lesson-sentence-unanswered")?.firstChild;
		assert.equal(isEligibleLearningTarget(unansweredSentence, "sk"), false);
	});

	it("ALLOWS REVIEW: enables word lookup in exercise sentence AFTER the user has answered", () => {
		const answeredSentence = document.getElementById("lesson-sentence-answered")?.firstChild;
		assert.equal(isEligibleLearningTarget(answeredSentence, "sk"), true);
	});

	it("strictly rejects English instructions and translations inside exercises", () => {
		const instruction = document.getElementById("lesson-instruction")?.firstChild;
		assert.equal(isEligibleLearningTarget(instruction, "sk"), false);

		const translation = document.getElementById("lesson-translation")?.firstChild;
		assert.equal(isEligibleLearningTarget(translation, "sk"), false);
	});

	it("allows reading story text in the target language (<article> with lang='sk')", () => {
		const storyPara = document.getElementById("reader-para")?.firstChild;
		assert.equal(isEligibleLearningTarget(storyPara, "sk"), true);

		// Rejects English translations even inside an article
		const storyEn = document.getElementById("reader-en-trans")?.firstChild;
		assert.equal(isEligibleLearningTarget(storyEn, "sk"), false);
	});

	it("allows subtitles inside watch containers ([data-word-column])", () => {
		const subLine = document.getElementById("sub-line")?.firstChild;
		assert.equal(isEligibleLearningTarget(subLine, "sk"), true);
	});

	it("allows tutor passages in AI chat (.lanna-source-passage)", () => {
		const tutorText = document.getElementById("tutor-text")?.firstChild;
		assert.equal(isEligibleLearningTarget(tutorText, "sk"), true);
	});

	it("rejects elements when disconnected / unmounted", () => {
		const detachedEl = document.createElement("p");
		detachedEl.setAttribute("lang", "sk");
		detachedEl.textContent = "Testovacia veta";
		assert.equal(isEligibleLearningTarget(detachedEl.firstChild, "sk"), false);
	});

	it("allows looking up words inside saved phrases in the Word Bank, but rejects English translations", () => {
		const phraseSk = document.getElementById("saved-phrase-sk")?.firstChild;
		assert.equal(isEligibleLearningTarget(phraseSk, "sk"), true);

		const phraseEn = document.getElementById("saved-phrase-en")?.firstChild;
		assert.equal(isEligibleLearningTarget(phraseEn, "sk"), false);
	});

	it("reading comprehension check: rejects before answering, allows after answering", () => {
		const checkUnanswered = document.getElementById("read-check-q-unanswered")?.firstChild;
		assert.equal(isEligibleLearningTarget(checkUnanswered, "sk"), false);

		const checkAnswered = document.getElementById("read-check-q-answered")?.firstChild;
		assert.equal(isEligibleLearningTarget(checkAnswered, "sk"), true);
	});

	it("placement test: rejects during testing, allows after grading", () => {
		const placeUnanswered = document.getElementById("placement-sentence-unanswered")?.firstChild;
		assert.equal(isEligibleLearningTarget(placeUnanswered, "sk"), false);

		const placeAnswered = document.getElementById("placement-sentence-answered")?.firstChild;
		assert.equal(isEligibleLearningTarget(placeAnswered, "sk"), true);
	});

	it("speak dialogue: allows inspecting past turns, rejects active choices", () => {
		const pastTurn = document.getElementById("speak-past-line")?.firstChild;
		assert.equal(isEligibleLearningTarget(pastTurn, "sk"), true);

		const activeChoice = document.querySelector("#speak-choice-1 span")?.firstChild;
		assert.equal(isEligibleLearningTarget(activeChoice, "sk"), false);
	});
});
