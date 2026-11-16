/**
 * Curated near-miss distractors for Slovak curriculum sentences.
 * Populates data/profiles/slovak/distractors/near-misses.jsonl ahead of time
 * so meaning reps and listening tasks run token-free without runtime LLM fallback.
 */

import { distractorStore, type NearMiss } from "../src/store/distractors.ts";

const NOW = new Date().toISOString();

export const CURATED_DISTRACTORS: Array<{ sk: string; en: string; near: [string, string] }> = [
	// Greetings & Essentials
	{ sk: "Ahoj, ako sa máš?", en: "Hi, how are you?", near: ["Hi, how is he?", "Hi, who are you?"] },
	{ sk: "Ahoj, maj sa!", en: "Bye, take care!", near: ["Hello, take care!", "Bye, see you yesterday!"] },
	{
		sk: "Tak ahoj, uvidíme sa zajtra.",
		en: "Bye then, see you tomorrow.",
		near: ["Bye then, we saw each other yesterday.", "Bye then, see you next week."],
	},
	{
		sk: "Ahoj, kamarát, čo robíš?",
		en: "Hi, friend, what are you doing?",
		near: ["Hi, friend, what are they doing?", "Hi, friend, where are you going?"],
	},
	{ sk: "Ahoj, čo je nové?", en: "Hi, what's new?", near: ["Hi, what was that?", "Hi, who is new?"] },
	{
		sk: "Ďakujem za pomoc.",
		en: "Thank you for the help.",
		near: ["We thank you for the help.", "Thank you for the book."],
	},
	{ sk: "Ďakujem pekne.", en: "Thank you kindly.", near: ["Thank you very much tomorrow.", "Please, kindly."] },
	{
		sk: "Ďakujem, to je od vás milé.",
		en: "Thank you, that's kind of you.",
		near: ["Thank you, that's kind of him.", "Please, that's rude of you."],
	},
	{
		sk: "Ďakujem, mám sa dobre.",
		en: "Thanks, I am doing well.",
		near: ["Thanks, we are doing well.", "Thanks, he is doing well."],
	},
	{ sk: "Jednu kávu, prosím.", en: "One coffee, please.", near: ["Two coffees, please.", "One tea, please."] },
	{ sk: "Prosím, sadnite si.", en: "Please sit down.", near: ["Please stand up.", "Please wait here."] },
	{
		sk: "Prosím vás, kde je stanica?",
		en: "Excuse me, where is the station?",
		near: ["Excuse me, where was the station?", "Excuse me, who is at the station?"],
	},
	{
		sk: "Prosím, môžem si sadnúť?",
		en: "Please, may I sit down?",
		near: ["Please, may we sit down?", "Please, may you sit down?"],
	},
	{ sk: "Áno, rozumiem.", en: "Yes, I understand.", near: ["No, I understand.", "Yes, they understand."] },
	{
		sk: "Máš čas? — Áno, mám.",
		en: "Do you have time? — Yes, I do.",
		near: ["Does he have time? — Yes, he does.", "Do you have money? — Yes, I do."],
	},
	{
		sk: "Áno, hneď prídem.",
		en: "Yes, I'm coming right away.",
		near: ["Yes, he is coming right away.", "Yes, I came right away."],
	},
	{
		sk: "Áno, už rozumiem.",
		en: "Yes, I understand now.",
		near: ["Yes, you understand now.", "Yes, I understood yesterday."],
	},
	{ sk: "Nie, ďakujem.", en: "No, thank you.", near: ["Yes, thank you.", "No, please."] },
	{ sk: "Nie je to pravda.", en: "That is not true.", near: ["That was true.", "That is true."] },
	{
		sk: "Nie, to nie je moja taška.",
		en: "No, that isn't my bag.",
		near: ["No, that is my bag.", "No, that isn't his bag."],
	},
	{
		sk: "Dnes nie, možno zajtra.",
		en: "Not today, maybe tomorrow.",
		near: ["Not tomorrow, maybe today.", "Not today, maybe yesterday."],
	},
	{
		sk: "Nie, ďakujem, nechcem.",
		en: "No, thank you, I don't want any.",
		near: ["No, thank you, we don't want any.", "Yes, thank you, I want some."],
	},
	{
		sk: "Dobrý deň, pani Nováková.",
		en: "Hello, Ms. Nováková.",
		near: ["Goodbye, Ms. Nováková.", "Hello, Mr. Novák."],
	},
	{
		sk: "Dobrý deň, ako sa máte?",
		en: "Good day, how are you?",
		near: ["Good evening, how are you?", "Good day, how is she?"],
	},
	{
		sk: "Dobrý deň, máte voľný stôl?",
		en: "Hello, do you have a free table?",
		near: ["Hello, do you have a free room?", "Hello, did you have a free table?"],
	},
	{
		sk: "Dobrý deň, hľadám poštu.",
		en: "Hello, I'm looking for the post office.",
		near: ["Hello, we are looking for the post office.", "Hello, I found the post office."],
	},
	{ sk: "Ďakujem, dovidenia.", en: "Thank you, goodbye.", near: ["Please, goodbye.", "Thank you, good morning."] },
	{
		sk: "Dovidenia, prajem pekný deň.",
		en: "Goodbye, have a nice day.",
		near: ["Hello, have a nice day.", "Goodbye, have a nice evening."],
	},
	{
		sk: "Dovidenia a ďakujem za všetko.",
		en: "Goodbye and thank you for everything.",
		near: ["Hello and thank you for everything.", "Goodbye and we thank you for nothing."],
	},
	{
		sk: "Prepáčte, kde je stanica?",
		en: "Excuse me, where is the station?",
		near: ["Please, where is the hotel?", "Excuse me, when is the train?"],
	},
	{
		sk: "Prepáčte, nerozumiem.",
		en: "Sorry, I don’t understand.",
		near: ["Sorry, we don't understand.", "Sorry, I understand."],
	},
	{
		sk: "Prepáčte, je toto miesto voľné?",
		en: "Excuse me, is this seat free?",
		near: ["Excuse me, was this seat free?", "Excuse me, is this table free?"],
	},
	{ sk: "Prepáčte, že meškám.", en: "Sorry I'm late.", near: ["Sorry he is late.", "Sorry we were late."] },
	{ sk: "Ako sa voláš?", en: "What is your name?", near: ["What is his name?", "Where do you live?"] },
	{
		sk: "Ako sa to povie po slovensky?",
		en: "How do you say that in Slovak?",
		near: ["How did you say that in Slovak?", "How do they say that in English?"],
	},
	{
		sk: "Ako sa dostanem na stanicu?",
		en: "How do I get to the station?",
		near: ["How do we get to the hotel?", "When did you get to the station?"],
	},
	{
		sk: "Je vysoký ako otec.",
		en: "He's as tall as his father.",
		near: ["She is as tall as her mother.", "He was shorter than his father."],
	},
	{ sk: "Kde bývaš?", en: "Where do you live?", near: ["Where does he live?", "Where did you work?"] },
	{ sk: "Kde je toaleta?", en: "Where is the toilet?", near: ["Where was the bathroom?", "Where is the entrance?"] },
	{
		sk: "Kde je najbližšia lekáreň?",
		en: "Where is the nearest pharmacy?",
		near: ["Where was the nearest pharmacy?", "Where is the nearest hospital?"],
	},
	{
		sk: "Neviem, kde sú kľúče.",
		en: "I don't know where the keys are.",
		near: ["We don't know where the keys are.", "I know where the keys are."],
	},
	{ sk: "Čo to znamená?", en: "What does that mean?", near: ["What did that mean?", "Who said that?"] },
	{ sk: "Čo robíš?", en: "What are you doing?", near: ["What is he doing?", "What did you do?"] },
	{
		sk: "Čo si dáte na obed?",
		en: "What will you have for lunch?",
		near: ["What did you have for lunch?", "What will they have for breakfast?"],
	},
	{ sk: "Čo hľadáš?", en: "What are you looking for?", near: ["What is she looking for?", "Where are you going?"] },
	{
		sk: "Čo robíš zajtra?",
		en: "What are you doing tomorrow?",
		near: ["What did you do yesterday?", "What is he doing tomorrow?"],
	},
	{ sk: "Kto je to?", en: "Who is that?", near: ["What is that?", "Where is that?"] },
	{ sk: "Kto hovorí po anglicky?", en: "Who speaks English?", near: ["Who speaks Slovak?", "Who spoke German?"] },
	{ sk: "Kto tam býva?", en: "Who lives there?", near: ["Who worked there?", "Where does he live?"] },
	{ sk: "Koľko to stojí?", en: "How much does it cost?", near: ["How much did it cost?", "How many are there?"] },
	{ sk: "Koľko máš rokov?", en: "How old are you?", near: ["How old is he?", "How many brothers do you have?"] },
	{ sk: "Koľko je hodín?", en: "What time is it?", near: ["What day is it?", "How many hours left?"] },

	// Verbs & Daily Sentences
	{
		sk: "Trochu rozumiem po slovensky.",
		en: "I understand a little Slovak.",
		near: ["We understand a little Slovak.", "I don't understand any Slovak."],
	},
	{ sk: "Hovorím po slovensky.", en: "I speak Slovak.", near: ["He speaks Slovak.", "I spoke Slovak."] },
	{
		sk: "Včera som hovoril s Petrom.",
		en: "Yesterday I talked to Peter.",
		near: ["Tomorrow I will talk to Peter.", "Yesterday we talked to Peter."],
	},
	{
		sk: "Chcem hovoriť slovensky.",
		en: "I want to speak Slovak.",
		near: ["They want to speak Slovak.", "I don't want to speak Slovak."],
	},
	{ sk: "Môžeš hovoriť pomaly?", en: "Can you speak slowly?", near: ["Can he speak slowly?", "Can you speak louder?"] },
	{
		sk: "Učím sa po slovensky.",
		en: "I am learning Slovak.",
		near: ["We are learning Slovak.", "I was teaching Slovak."],
	},
	{
		sk: "Hovoríte po slovensky?",
		en: "Do you speak Slovak?",
		near: ["Does she speak Slovak?", "Did you speak English?"],
	},
	{
		sk: "Učím sa nové slová.",
		en: "I am learning new words.",
		near: ["He is learning new words.", "I learned old words."],
	},
	{
		sk: "Učíš sa každý deň?",
		en: "Do you study every day?",
		near: ["Does he study every day?", "Did you study yesterday?"],
	},
	{
		sk: "Včera som sa učil do noci.",
		en: "Yesterday I studied late into the night.",
		near: ["Tonight I will study late into the night.", "Yesterday we studied late into the night."],
	},
	{
		sk: "Musím sa učiť na skúšku.",
		en: "I have to study for an exam.",
		near: ["We have to study for an exam.", "I had to study for an exam."],
	},
	{ sk: "Toto slovo je nové.", en: "This word is new.", near: ["That word was old.", "This word is hard."] },
	{ sk: "Neviem to slovo.", en: "I don’t know that word.", near: ["We don't know that word.", "I know that word."] },
	{
		sk: "Ako sa píše to slovo?",
		en: "How do you spell that word?",
		near: ["How did they spell that word?", "What does that word mean?"],
	},
	{
		sk: "Slovenčina je slovanský jazyk.",
		en: "Slovak is a Slavic language.",
		near: ["Slovak was a Germanic language.", "Russian is a Romance language."],
	},
	{
		sk: "Učím sa cudzí jazyk.",
		en: "I am learning a foreign language.",
		near: ["He is learning a foreign language.", "I learned a foreign language."],
	},
	{ sk: "Náš dom je malý.", en: "Our house is small.", near: ["Their house is small.", "Our house is big."] },
	{ sk: "Mám nový dom.", en: "I have a new house.", near: ["He has a new house.", "I had an old house."] },
	{
		sk: "Bývame v starom dome.",
		en: "We live in an old house.",
		near: ["They live in an old house.", "We lived in a new apartment."],
	},
	{
		sk: "Pred domom stojí auto.",
		en: "There's a car in front of the house.",
		near: ["There's a bicycle behind the house.", "A car was parking inside the garage."],
	},
	{
		sk: "Moja rodina žije na Slovensku.",
		en: "My family lives in Slovakia.",
		near: ["His family lives in Slovakia.", "My family lived in Austria."],
	},
	{ sk: "Mám veľkú rodinu.", en: "I have a big family.", near: ["She has a big family.", "I have a small family."] },
	{
		sk: "Víkend trávim s rodinou.",
		en: "I spend the weekend with my family.",
		near: ["We spend the weekend with our friends.", "He spent the weekend alone."],
	},
	{ sk: "Peter je môj priateľ.", en: "Peter is my friend.", near: ["Peter is his friend.", "Peter was my brother."] },
	{
		sk: "Idem s priateľom.",
		en: "I am going with a friend.",
		near: ["We are going with a friend.", "I am going without a friend."],
	},
	{
		sk: "Moji priatelia bývajú v Žiline.",
		en: "My friends live in Žilina.",
		near: ["His friends live in Žilina.", "My friends lived in Bratislava."],
	},
	{ sk: "Je to dobrý človek.", en: "He is a good person.", near: ["She was a bad person.", "They are good people."] },
	{
		sk: "Každý človek potrebuje priateľov.",
		en: "Every person needs friends.",
		near: ["No person needs friends.", "Some people need money."],
	},
	{
		sk: "Toho človeka nepoznám.",
		en: "I don't know that person.",
		near: ["We don't know that person.", "I know that person."],
	},
	{ sk: "Ten muž čaká.", en: "That man is waiting.", near: ["Those men are waiting.", "That woman is leaving."] },
	{
		sk: "Môj muž pracuje v Bratislave.",
		en: "My husband works in Bratislava.",
		near: ["Her husband works in Bratislava.", "My husband worked in Košice."],
	},
	{ sk: "Tá žena číta.", en: "That woman is reading.", near: ["Those women are reading.", "That man is writing."] },
	{
		sk: "Moja žena je učiteľka.",
		en: "My wife is a teacher.",
		near: ["His wife is a teacher.", "My sister is a doctor."],
	},
	{
		sk: "Kúpil som žene kvety.",
		en: "I bought my wife flowers.",
		near: ["He bought his wife flowers.", "I will buy my wife flowers."],
	},
	{ sk: "Toto jedlo je výborné.", en: "This food is excellent.", near: ["That food was cold.", "This food is bad."] },
	{ sk: "Kde je dobré jedlo?", en: "Where is good food?", near: ["Where was good food?", "Who cooked the food?"] },
	{
		sk: "Pred jedlom si umy ruky.",
		en: "Wash your hands before eating.",
		near: ["Wash your hands after eating.", "Brush your teeth before sleeping."],
	},
	{
		sk: "Slovenské jedlá sú chutné.",
		en: "Slovak dishes are tasty.",
		near: ["Czech dishes are sweet.", "Slovak dishes were spicy."],
	},
	{
		sk: "Prosím si pohár vody.",
		en: "I’d like a glass of water.",
		near: ["We'd like a bottle of wine.", "I wanted a cup of coffee."],
	},
	{
		sk: "Pijem veľa vody.",
		en: "I drink a lot of water.",
		near: ["He drinks a lot of water.", "I drank a cup of tea."],
	},
	{
		sk: "Voda v jazere je studená.",
		en: "The water in the lake is cold.",
		near: ["The water in the river is warm.", "The water in the pool was dirty."],
	},
	{ sk: "Dáte si kávu?", en: "Would you like coffee?", near: ["Did you drink coffee?", "Would they like tea?"] },
	{
		sk: "Ráno pijem kávu.",
		en: "I drink coffee in the morning.",
		near: ["He drinks coffee in the morning.", "I drank coffee in the evening."],
	},
	{
		sk: "Poprosím čiernu kávu.",
		en: "Black coffee, please.",
		near: ["Coffee with milk, please.", "Black tea, please."],
	},
	{
		sk: "Ideme na kávu?",
		en: "Shall we go for a coffee?",
		near: ["Did they go for coffee?", "Shall we go for lunch?"],
	},
	{ sk: "Káva je horúca.", en: "The coffee is hot.", near: ["The tea was cold.", "The coffee is cold."] },
	{
		sk: "Moja mama pečie koláč.",
		en: "My mom is baking a cake.",
		near: ["His mom is baking bread.", "My grandmother baked a cake."],
	},
	{
		sk: "Ten koláč je výborný.",
		en: "That cake is excellent.",
		near: ["This cake was sweet.", "Those cookies are delicious."],
	},
	{
		sk: "Dáš si kúsok koláča?",
		en: "Would you like a piece of cake?",
		near: ["Did he want a piece of cake?", "Would you like a cup of tea?"],
	},
	{ sk: "Večera je o šiestej.", en: "Dinner is at six.", near: ["Breakfast was at seven.", "Dinner is at eight."] },
	{
		sk: "Na večeru mám polievku.",
		en: "I have soup for dinner.",
		near: ["We had soup for lunch.", "He has bread for dinner."],
	},
	{
		sk: "Po večeri ideme na prechádzku.",
		en: "After dinner we go for a walk.",
		near: ["Before dinner we went for a run.", "After dinner they went to sleep."],
	},
	{
		sk: "Pozývam ťa na večeru.",
		en: "I'm inviting you to dinner.",
		near: ["He is inviting us to lunch.", "I invited you to dinner yesterday."],
	},
	{ sk: "Obed je pripravený.", en: "Lunch is ready.", near: ["Dinner was cancelled.", "Breakfast is served."] },
	{
		sk: "Na obed jem chlieb a syr.",
		en: "I eat bread and cheese for lunch.",
		near: ["He eats bread and cheese for lunch.", "I ate meat and potatoes for dinner."],
	},
	{
		sk: "Pozvala ma na obed.",
		en: "She invited me to lunch.",
		near: ["He invited me to lunch.", "She will invite me to dinner."],
	},
	{
		sk: "Raňajky mám o siedmej.",
		en: "I have breakfast at seven.",
		near: ["We have breakfast at eight.", "He had breakfast at seven."],
	},
	{
		sk: "Na raňajky jem chlieb s maslom.",
		en: "I eat bread with butter for breakfast.",
		near: ["She eats bread with butter for breakfast.", "I ate eggs for breakfast."],
	},
	{ sk: "Raňajky sú hotové.", en: "Breakfast is ready.", near: ["Dinner is ready.", "Breakfast was cold."] },
	{
		sk: "Po raňajkách idem do práce.",
		en: "After breakfast I go to work.",
		near: ["Before breakfast he goes to work.", "After breakfast we went to school."],
	},
	{
		sk: "Pijem ráno mlieko.",
		en: "I drink milk in the morning.",
		near: ["She drinks milk in the morning.", "I drank coffee in the morning."],
	},
	{
		sk: "Mlieko je v chladničke.",
		en: "The milk is in the fridge.",
		near: ["The butter is on the table.", "The milk was on the counter."],
	},
	{
		sk: "Kúp, prosím, mlieko a chlieb.",
		en: "Please buy milk and bread.",
		near: ["Please bring milk and butter.", "He bought milk and bread."],
	},
	{
		sk: "Pijem kávu bez mlieka.",
		en: "I drink my coffee without milk.",
		near: ["He drinks his coffee with milk.", "I drank tea without sugar."],
	},
	{ sk: "Polievka je horúca.", en: "The soup is hot.", near: ["The soup was cold.", "The tea is hot."] },
	{
		sk: "Dám si zeleninovú polievku.",
		en: "I’ll have vegetable soup.",
		near: ["We'll have chicken soup.", "He had vegetable soup."],
	},
	{
		sk: "Večer pijem čaj.",
		en: "I drink tea in the evening.",
		near: ["She drinks tea in the evening.", "I drank coffee in the morning."],
	},
	{ sk: "Prosím si teplý čaj.", en: "I’d like hot tea.", near: ["We'd like cold water.", "I wanted hot tea."] },
	{ sk: "Uvarím ti čaj.", en: "I'll make you some tea.", near: ["He made you some coffee.", "We will make them tea."] },
	{ sk: "Zelený čaj je zdravý.", en: "Green tea is healthy.", near: ["Black tea is strong.", "Green tea was bitter."] },
	{
		sk: "Mám rád slovenský syr.",
		en: "I like Slovak cheese.",
		near: ["He likes Slovak cheese.", "I liked Swiss cheese."],
	},
	{
		sk: "Tento syr je z Liptova.",
		en: "This cheese is from Liptov.",
		near: ["That cheese was from Orava.", "This cheese is from France."],
	},
	{
		sk: "Maslo je v chladničke.",
		en: "The butter is in the fridge.",
		near: ["The milk was on the table.", "The butter is on the table."],
	},
	{
		sk: "Na chlieb dávam maslo.",
		en: "I put butter on bread.",
		near: ["She puts butter on bread.", "I put cheese on bread."],
	},

	// Lesson Specific Sentences (from active lesson units)
	{
		sk: "Počúvam hudbu.",
		en: "I'm listening to music.",
		near: ["He is listening to music.", "I was listening to music."],
	},
	{ sk: "Nemám bicykla.", en: "I don't have a bicycle.", near: ["We don't have a bicycle.", "I have a bicycle."] },
	{ sk: "Dúfam, že nie.", en: "I hope not.", near: ["I hope so.", "He hopes not."] },
	{ sk: "Bývam v hoteli.", en: "I live in a hotel.", near: ["He lives in a hotel.", "I lived in a hotel."] },
	{
		sk: "Chodím do školy.",
		en: "I go to school (habitually).",
		near: ["We go to school (habitually).", "He went to school (habitually)."],
	},
	{
		sk: "Hovorte pomalšie, prosím.",
		en: "Please speak more slowly.",
		near: ["Please speak louder.", "Please write more slowly."],
	},
	{ sk: "Nič nevidím.", en: "I cannot see anything.", near: ["We cannot see anything.", "I saw everything."] },
	{
		sk: "Už začína hovoriť.",
		en: "He's already beginning to talk.",
		near: ["He already stopped talking.", "I am already beginning to talk."],
	},
	{ sk: "Poznám pravdu.", en: "I know the truth.", near: ["I knew the truth.", "You know the truth."] },
	{ sk: "Kúpim knihu.", en: "I'll buy a book.", near: ["I bought a book.", "She will buy a book."] },
	{ sk: "Vidím brata.", en: "I see my brother.", near: ["He sees my brother.", "I saw my brother."] },
	{ sk: "Mám rád knihy.", en: "I like books.", near: ["She likes books.", "I liked the book."] },
	{
		sk: "Čítam noviny.",
		en: "I am reading the newspaper.",
		near: ["We are reading the newspaper.", "I read the book."],
	},
	{ sk: "Píšem list.", en: "I am writing a letter.", near: ["He is writing a letter.", "I wrote a letter."] },
	{
		sk: "Pracujem v Bratislave.",
		en: "I work in Bratislava.",
		near: ["We work in Bratislava.", "I worked in Žilina."],
	},
	{ sk: "Cestujem vlakom.", en: "I am traveling by train.", near: ["He is traveling by train.", "I traveled by bus."] },
	{ sk: "Idem domov.", en: "I am going home.", near: ["They are going home.", "I came home."] },
	{
		sk: "Čakám na stanici.",
		en: "I am waiting at the station.",
		near: ["She is waiting at the station.", "I waited at the airport."],
	},
	{ sk: "Hľadám hotel.", en: "I am looking for a hotel.", near: ["We are looking for a hotel.", "I found the hotel."] },
	{
		sk: "Otvor okno, prosím.",
		en: "Open the window, please.",
		near: ["Close the window, please.", "Open the door, please."],
	},
	{
		sk: "Zavri dvere, prosím.",
		en: "Close the door, please.",
		near: ["Open the door, please.", "Close the window, please."],
	},
];

export function generateCuratedDistractors(): number {
	const entries: NearMiss[] = CURATED_DISTRACTORS.map((item) => ({
		sk: item.sk,
		en: item.en,
		near: [item.near[0], item.near[1]],
		model: "curated:token-minimization",
		createdAt: NOW,
		tokens: { input: 0, output: 0 },
	}));

	distractorStore.append(entries);
	return entries.length;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "")) {
	const count = generateCuratedDistractors();
	console.log(`Successfully generated and cached ${count} curated near-miss distractors.`);
}
