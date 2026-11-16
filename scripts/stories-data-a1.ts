export interface StorySource {
	id: string;
	title: string;
	level: "A1" | "A2" | "B1" | "B2";
	chapter: string;
	genre:
		| "dialogue"
		| "travel"
		| "folk"
		| "diary"
		| "message"
		| "fable"
		| "news"
		| "interview"
		| "work"
		| "opinion"
		| "history"
		| "robo";
	theme: string;
	topic: string;
	recap: string;
	cast: { name: string; gender: "f" | "m"; age: "young" | "adult" | "old" }[];
	sentences: { who?: string; sk: string; en: string }[];
	newWords: { sk: string; en: string }[];
	questions: {
		kind: "recall" | "sequence" | "detail" | "vocab" | "gist" | "inference" | "attitude";
		q: string;
		options: string[];
		answer: number;
	}[];
}

export const STORIES_A1: StorySource[] = [
	{
		id: "a1-01-ja-som-matej",
		title: "Ahoj, ja som Matej",
		level: "A1",
		chapter: "hello",
		genre: "dialogue",
		theme: "introducing oneself and hometown",
		topic: "Matej introduces himself, his town, work, and daily life",
		recap:
			"Matej introduces himself, his hometown Banská Štiavnica, his apartment, work as a designer, and morning routines.",
		cast: [{ name: "Matej", gender: "m", age: "young" }],
		sentences: [
			{ who: "Matej", sk: "Ahoj! Vitajte na Slovensku.", en: "Hi! Welcome to Slovakia." },
			{
				who: "Matej",
				sk: "Ja sa volám Matej a mám dvadsaťpäť rokov.",
				en: "My name is Matej and I am twenty-five years old.",
			},
			{
				who: "Matej",
				sk: "Bývam v Banskej Štiavnici v strednom Slovensku.",
				en: "I live in Banská Štiavnica in central Slovakia.",
			},
			{
				who: "Matej",
				sk: "Je to krásne historické mesto uprostred zelených hôr.",
				en: "It is a beautiful historical town amidst green mountains.",
			},
			{
				who: "Matej",
				sk: "Naše mesto je známe starými baňami na striebro a zlato.",
				en: "Our town is known for old silver and gold mines.",
			},
			{
				who: "Matej",
				sk: "Môj byt sa nachádza v tichej uličke blízko historického námestia.",
				en: "My flat is located on a quiet street near the historical square.",
			},
			{
				who: "Matej",
				sk: "Mám jedno malé štúdio s výhľadom na starý kostol.",
				en: "I have one small studio with a view of the old church.",
			},
			{
				who: "Matej",
				sk: "Pracujem ako grafický dizajnér na počítači.",
				en: "I work as a graphic designer on the computer.",
			},
			{
				who: "Matej",
				sk: "Kreslím plagáty, ilustrácie a obálky pre knihy.",
				en: "I draw posters, illustrations and covers for books.",
			},
			{
				who: "Matej",
				sk: "Moja práca je veľmi zaujímavá a kreatívna.",
				en: "My job is very interesting and creative.",
			},
			{ who: "Matej", sk: "Každé ráno vstávam o siedmej hodine.", en: "Every morning I get up at seven o'clock." },
			{
				who: "Matej",
				sk: "Otvorím okno a dýcham čerstvý horský vzduch.",
				en: "I open the window and breathe the fresh mountain air.",
			},
			{
				who: "Matej",
				sk: "Potom si uvarím silnú čiernu kávu bez cukru.",
				en: "Then I brew strong black coffee without sugar.",
			},
			{
				who: "Matej",
				sk: "Pri káve rád počúvam pokojnú akustickú hudbu.",
				en: "With coffee I like listening to calm acoustic music.",
			},
			{
				who: "Matej",
				sk: "Popoludní často chodím na prechádzku do lesa alebo okolo hradu.",
				en: "In the afternoon I often go for a walk into the forest or around the castle.",
			},
			{
				who: "Matej",
				sk: "Na ulici vždy pozdravím susedov a známych.",
				en: "On the street I always greet neighbors and acquaintances.",
			},
			{
				who: "Matej",
				sk: "Ľudia v našom meste sú veľmi priateľskí a milí.",
				en: "The people in our town are very friendly and nice.",
			},
			{
				who: "Matej",
				sk: "Večer rád čítam knihy alebo varím večeru pre priateľov.",
				en: "In the evening I like reading books or cooking dinner for friends.",
			},
			{
				who: "Matej",
				sk: "Veľmi sa teším, že sa učíte po slovensky.",
				en: "I am very pleased that you are learning Slovak.",
			},
			{
				who: "Matej",
				sk: "Slovenčina je krásny jazyk a verím, že sa vám bude páčiť!",
				en: "Slovak is a beautiful language and I believe you will like it!",
			},
		],
		newWords: [
			{ sk: "historický", en: "historical" },
			{ sk: "kresliť", en: "to draw" },
			{ sk: "sused", en: "neighbor" },
			{ sk: "priateľský", en: "friendly" },
		],
		questions: [
			{
				kind: "recall",
				q: "Koľko rokov má Matej?",
				options: ["Dvadsaťpäť rokov", "Tridsať rokov", "Dvadsať rokov"],
				answer: 0,
			},
			{
				kind: "detail",
				q: "Čo robí Matej každé ráno pri káve?",
				options: ["Číta noviny", "Počúva pokojnú hudbu", "Pozerá televíziu"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "Aké je Matejovo zamestnanie?",
				options: ["Učiteľ hudby", "Grafický dizajnér", "Čašník v kaviarni"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-02-moji-priatelia",
		title: "Moji dobrí priatelia",
		level: "A1",
		chapter: "hello",
		genre: "dialogue",
		theme: "talking about friends",
		topic: "Matej introduces his closest friends Zuzana and Martin",
		recap:
			"Matej introduces his best friends Zuzana from Bratislava and Martin from Košice, their work and shared weekend trips.",
		cast: [{ name: "Matej", gender: "m", age: "young" }],
		sentences: [
			{
				who: "Matej",
				sk: "Priateľstvo je v živote človeka veľmi dôležité.",
				en: "Friendship is very important in a person's life.",
			},
			{
				who: "Matej",
				sk: "Mám dvoch veľmi dobrých priateľov, ktorých poznám mnoho rokov.",
				en: "I have two very good friends whom I have known for many years.",
			},
			{
				who: "Matej",
				sk: "Moja kamarátka sa volá Zuzana a býva v Bratislave.",
				en: "My friend is named Zuzana and she lives in Bratislava.",
			},
			{
				who: "Matej",
				sk: "Zuzana pracuje v malom kníhkupectve v centre mesta.",
				en: "Zuzana works in a small bookstore in the city center.",
			},
			{
				who: "Matej",
				sk: "Veľmi rada číta romány, básne a cestopisy.",
				en: "She loves reading novels, poems and travel books.",
			},
			{
				who: "Matej",
				sk: "Vždy mi vie odporučiť skvelú novú knihu.",
				en: "She always knows how to recommend a great new book to me.",
			},
			{
				who: "Matej",
				sk: "Môj druhý kamarát Martin pochádza z Košíc na východe Slovenska.",
				en: "My second friend Martin comes from Košice in eastern Slovakia.",
			},
			{
				who: "Matej",
				sk: "Martin je učiteľ hudby na základnej škole.",
				en: "Martin is a music teacher at an elementary school.",
			},
			{
				who: "Matej",
				sk: "Výborne hrá na akustickej gitare a spieva tradičné piesne.",
				en: "He plays acoustic guitar excellently and sings traditional songs.",
			},
			{
				who: "Matej",
				sk: "Spoznali sme sa pred piatimi rokmi na univerzite.",
				en: "We met five years ago at university.",
			},
			{
				who: "Matej",
				sk: "Aj keď bývame v rôznych mestách, často si telefonujeme.",
				en: "Even though we live in different cities, we often call each other.",
			},
			{
				who: "Matej",
				sk: "Každý mesiac sa snažíme stretnúť aspoň na jeden víkend.",
				en: "Every month we try to meet up for at least one weekend.",
			},
			{
				who: "Matej",
				sk: "Niekedy prídu oni do Štiavnice a niekedy cestujem ja do Bratislavy.",
				en: "Sometimes they come to Štiavnica and sometimes I travel to Bratislava.",
			},
			{
				who: "Matej",
				sk: "Všetci traja máme radi turistiku v horách a dobré jedlo.",
				en: "All three of us like hiking in the mountains and good food.",
			},
			{
				who: "Matej",
				sk: "Keď sme spolu, radi varíme večeru a hráme spoločenské hry.",
				en: "When we are together, we like cooking dinner and playing board games.",
			},
			{
				who: "Matej",
				sk: "Martin vždy vezme gitaru a spievame slovenské ľudové piesne.",
				en: "Martin always takes his guitar and we sing Slovak folk songs.",
			},
			{
				who: "Matej",
				sk: "Zuzana nám rozpráva vtipné príbehy zo svojho obchodu.",
				en: "Zuzana tells us funny stories from her shop.",
			},
			{
				who: "Matej",
				sk: "S pravými priateľmi je každý deň krajší a veselší.",
				en: "With true friends every day is more beautiful and cheerful.",
			},
			{
				who: "Matej",
				sk: "Som vďačný, že mám okolo seba takýchto dobrých ľudí.",
				en: "I am grateful that I have such good people around me.",
			},
			{ who: "Matej", sk: "Aké sú vaše vzťahy s priateľmi vy?", en: "How are your relationships with friends?" },
		],
		newWords: [
			{ sk: "priateľstvo", en: "friendship" },
			{ sk: "kníhkupectvo", en: "bookstore" },
			{ sk: "spoločenský", en: "social, board (game)" },
			{ sk: "vďačný", en: "grateful" },
		],
		questions: [
			{ kind: "recall", q: "Kde pracuje Zuzana?", options: ["V kníhkupectve", "V škole", "V nemocnici"], answer: 0 },
			{
				kind: "detail",
				q: "Na akom hudobnom nástroji hrá Martin?",
				options: ["Na husliach", "Na gitare", "Na klavíri"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "O čom hovorí tento príbeh?",
				options: ["O hľadaní novej práce", "O priateľstve a spoločných chvíľach", "O štúdiu na univerzite"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-03-rano-v-kaviarni",
		title: "Ráno v kaviarni",
		level: "A1",
		chapter: "cafe",
		genre: "dialogue",
		theme: "ordering breakfast at a cafe",
		topic: "Matej orders morning coffee and fresh pastry from Eva",
		recap:
			"Matej visits the cozy café 'U Zlatej šálky', chats with barista Eva, orders espresso and a fresh poppy-seed pastry.",
		cast: [
			{ name: "Matej", gender: "m", age: "young" },
			{ name: "Eva", gender: "f", age: "adult" },
		],
		sentences: [
			{
				who: "Matej",
				sk: "Ráno v meste je pokojné a vzduch vonia čerstvou kávou.",
				en: "Morning in town is peaceful and the air smells of fresh coffee.",
			},
			{
				who: "Matej",
				sk: "Vchádzam do malej kaviarne s názvom U Zlatej šálky.",
				en: "I enter a small café named At the Golden Cup.",
			},
			{ who: "Eva", sk: "Dobré ráno, Matej! Vitajte u nás.", en: "Good morning, Matej! Welcome to our place." },
			{
				who: "Matej",
				sk: "Dobré ráno, Eva. Dnes je vonku krásny slnečný deň.",
				en: "Good morning, Eva. It is a beautiful sunny day outside today.",
			},
			{
				who: "Eva",
				sk: "Áno, počasie je nádherné. Čo si dnes dáte na raňajky?",
				en: "Yes, the weather is wonderful. What will you have for breakfast today?",
			},
			{ who: "Matej", sk: "Dám si jedno silné espresso, prosím.", en: "I'll have one strong espresso, please." },
			{
				who: "Eva",
				sk: "Želáte si kávu s mliekom alebo čistú čiernu?",
				en: "Would you like coffee with milk or pure black?",
			},
			{
				who: "Matej",
				sk: "Čistú čiernu, bez cukru a s pohárom studenej vody.",
				en: "Pure black, without sugar and with a glass of cold water.",
			},
			{
				who: "Eva",
				sk: "Máme dnes čerstvé domáce koláče, priamo z pece.",
				en: "We have fresh homemade cakes today, straight from the oven.",
			},
			{ who: "Matej", sk: "Aké koláče ste dnes upiekli?", en: "What cakes did you bake today?" },
			{
				who: "Eva",
				sk: "Máme tradičný makový závin a jablkový koláč so škoricou.",
				en: "We have traditional poppy-seed roll and apple cake with cinnamon.",
			},
			{
				who: "Matej",
				sk: "Makový závin znie vynikajúco. Prosím si jeden kúsok.",
				en: "Poppy-seed roll sounds excellent. One slice, please.",
			},
			{
				who: "Eva",
				sk: "Máte šťastie, závin je ešte príjemne teplý.",
				en: "You are lucky, the roll is still pleasantly warm.",
			},
			{
				who: "Matej",
				sk: "Vždy tu tak krásne rozvoniava vanilka a mak.",
				en: "Vanilla and poppy seeds always smell so wonderful here.",
			},
			{
				who: "Eva",
				sk: "Nech sa páči, tu je vaša horúca káva a koláč.",
				en: "Here you are, here is your hot coffee and cake.",
			},
			{
				who: "Matej",
				sk: "Ďakujem veľmi pekne. Koľko to spolu stojí?",
				en: "Thank you very much. How much does it cost altogether?",
			},
			{
				who: "Eva",
				sk: "Káva stojí dve eurá a koláč dve eurá a päťdesiat centov. Spolu štyri eurá a päťdesiat centov.",
				en: "Coffee is two euros and cake is two euros fifty cents. Together four euros fifty cents.",
			},
			{
				who: "Matej",
				sk: "Páči sa, tu je päť eur. Zvyšok si nechajte ako prepitné.",
				en: "Here you go, here is five euros. Keep the change as a tip.",
			},
			{
				who: "Eva",
				sk: "Ďakujem pekne, Matej! Prajem vám príjemnú chuť a pekný deň.",
				en: "Thank you nicely, Matej! Enjoy your food and have a nice day.",
			},
			{
				who: "Matej",
				sk: "Sadám si k malému stolu pri okne a vychutnávam si pokojné ráno.",
				en: "I sit down at a small table by the window and enjoy the quiet morning.",
			},
		],
		newWords: [
			{ sk: "závin", en: "roll, strudel" },
			{ sk: "škorica", en: "cinnamon" },
			{ sk: "prepitné", en: "tip (gratuity)" },
			{ sk: "vychutnávať", en: "to savor, enjoy" },
		],
		questions: [
			{
				kind: "recall",
				q: "Akú kávu si objednal Matej?",
				options: ["Espresso s mliekom", "Čistú čiernu kávu bez cukru", "Sladké kapučíno"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Aký koláč si Matej vybral?",
				options: ["Makový závin", "Jablkový koláč", "Čokoládovú tortu"],
				answer: 0,
			},
			{
				kind: "detail",
				q: "Kde si Matej sadol?",
				options: ["Na terasu", "K stolu pri okne", "K barovému pultu"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-04-nasa-rodina",
		title: "Naša milá rodina",
		level: "A1",
		chapter: "family",
		genre: "dialogue",
		theme: "talking about family",
		topic: "Matej describes his parents, sister, grandparents, and family traditions",
		recap:
			"Matej introduces his parents Peter and Elena, sister Lucia, grandparents in the village, and their beloved Sunday lunch tradition.",
		cast: [{ name: "Matej", gender: "m", age: "young" }],
		sentences: [
			{
				who: "Matej",
				sk: "Rodina je základ môjho života a mám ju veľmi rád.",
				en: "Family is the foundation of my life and I love it very much.",
			},
			{
				who: "Matej",
				sk: "Môj otec sa volá Peter a má päťdesiatdva rokov.",
				en: "My father is named Peter and is fifty-two years old.",
			},
			{
				who: "Matej",
				sk: "Otec je stavebný inžinier a rád opravuje staré veci v dielni.",
				en: "Father is a civil engineer and likes repairing old things in his workshop.",
			},
			{
				who: "Matej",
				sk: "Moja mama sa volá Elena a pracuje ako zdravotná sestra.",
				en: "My mother is named Elena and works as a nurse.",
			},
			{
				who: "Matej",
				sk: "Mama je veľmi láskavá, trpezlivá a vždy ochotná pomôcť.",
				en: "Mother is very kind, patient and always willing to help.",
			},
			{
				who: "Matej",
				sk: "Mám jednu staršiu sestru, ktorá sa volá Lucia.",
				en: "I have one older sister named Lucia.",
			},
			{
				who: "Matej",
				sk: "Lucia je vydatá, býva v Žiline a má malého syna Tomáška.",
				en: "Lucia is married, lives in Žilina and has a young son Tomáško.",
			},
			{
				who: "Matej",
				sk: "Takže ja som už hrdý ujo a s Tomáškom sa rád hrám.",
				en: "So I am already a proud uncle and I like playing with Tomáško.",
			},
			{
				who: "Matej",
				sk: "Máme doma aj psa menom Dunčo, ktorý je verný strážca dvora.",
				en: "We also have a dog at home named Dunčo, who is a loyal yard guardian.",
			},
			{
				who: "Matej",
				sk: "Dunčo má hustú hnedú srsť a miluje dlhé prechádzky.",
				en: "Dunčo has thick brown fur and loves long walks.",
			},
			{
				who: "Matej",
				sk: "Moji starí rodičia bývajú v malej dedinke neďaleko nášho mesta.",
				en: "My grandparents live in a small village not far from our town.",
			},
			{
				who: "Matej",
				sk: "Starý otec Ján má sedemdesiatpäť rokov a stále pracuje v záhrade.",
				en: "Grandfather Ján is seventy-five years old and still works in the garden.",
			},
			{
				who: "Matej",
				sk: "Stará mama Mária vie uvariť najlepšiu slepačiu polievku na svete.",
				en: "Grandmother Mária knows how to cook the best chicken soup in the world.",
			},
			{
				who: "Matej",
				sk: "Každú nedeľu sa celá rodina stretáva pri spoločnom obede.",
				en: "Every Sunday the whole family meets for a shared lunch.",
			},
			{
				who: "Matej",
				sk: "Sedíme pri veľkom drevenom stole a rozprávame sa o celom týždni.",
				en: "We sit at a big wooden table and talk about the whole week.",
			},
			{
				who: "Matej",
				sk: "Starý otec nám často hovorí vtipné príhody zo svojej mladosti.",
				en: "Grandfather often tells us funny stories from his youth.",
			},
			{
				who: "Matej",
				sk: "Mama a stará mama vždy upečú sladký koláč ku káve.",
				en: "Mom and grandma always bake a sweet cake with coffee.",
			},
			{
				who: "Matej",
				sk: "Tieto spoločné chvíle pokoja sú pre mňa neoceniteľné.",
				en: "These shared moments of peace are priceless to me.",
			},
			{
				who: "Matej",
				sk: "Viem, že sa na svoju rodinu môžem kedykoľvek spoľahnúť.",
				en: "I know that I can rely on my family at any time.",
			},
			{
				who: "Matej",
				sk: "Je veľké šťastie mať domov plný lásky a porozumenia.",
				en: "It is great fortune to have a home full of love and understanding.",
			},
		],
		newWords: [
			{ sk: "láskavý", en: "kind, affectionate" },
			{ sk: "ujo", en: "uncle" },
			{ sk: "strážca", en: "guardian, guard" },
			{ sk: "spoľahnúť sa", en: "to rely upon" },
		],
		questions: [
			{ kind: "recall", q: "Čo robí Matejov otec?", options: ["Je inžinier", "Je lekár", "Je kuchár"], answer: 0 },
			{
				kind: "detail",
				q: "Ako sa volá Matejova sestra a kde býva?",
				options: ["Zuzana v Bratislave", "Lucia v Žiline", "Elena v Košiciach"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "Aká je hlavná nedeľná tradícia v rodine?",
				options: ["Chodia na túru", "Stretávajú sa pri spoločnom obede", "Pozerajú futbal"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-05-v-obchode",
		title: "V potravinách",
		level: "A1",
		chapter: "shopping",
		genre: "dialogue",
		theme: "buying groceries",
		topic: "Zuzana shops for fresh daily food at the local grocery store",
		recap:
			"Zuzana visits the local potraviny, buying fresh sourdough bread, Liptov bryndza cheese, butter, apples and honey from Mrs. Kováčová.",
		cast: [
			{ name: "Zuzana", gender: "f", age: "young" },
			{ name: "Pani Kováčová", gender: "f", age: "old" },
		],
		sentences: [
			{
				who: "Zuzana",
				sk: "Dnes popoludní potrebujem nakúpiť potraviny na večeru.",
				en: "This afternoon I need to buy groceries for dinner.",
			},
			{
				who: "Zuzana",
				sk: "Idem do malého obchodu na rohu našej ulice.",
				en: "I go to a small shop on the corner of our street.",
			},
			{
				who: "Pani Kováčová",
				sk: "Dobrý deň, Zuzanka! Ako sa dnes máte?",
				en: "Hello, Zuzanka! How are you doing today?",
			},
			{
				who: "Zuzana",
				sk: "Dobrý deň, pani Kováčová. Mám sa dobre, ďakujem. Prišla som po nákup.",
				en: "Hello, Mrs. Kováčová. I am doing well, thank you. I came for shopping.",
			},
			{ who: "Pani Kováčová", sk: "Čo dobré vám môžem dnes podať?", en: "What good things can I hand you today?" },
			{
				who: "Zuzana",
				sk: "Prosím si jeden čerstvý kváskový chlieb a liter plnotučného mlieka.",
				en: "I'd like one fresh sourdough loaf of bread and a liter of whole milk.",
			},
			{
				who: "Pani Kováčová",
				sk: "Nech sa páči. Chlebík priviezli z pekárne len pred hodinou.",
				en: "Here you are. They brought the bread from the bakery just an hour ago.",
			},
			{
				who: "Zuzana",
				sk: "Nádherne vonia! Máte aj čerstvú slovenskú bryndzu?",
				en: "It smells wonderful! Do you also have fresh Slovak bryndza?",
			},
			{
				who: "Pani Kováčová",
				sk: "Samozrejme, máme pravú májovú bryndzu priamo zo salaša na Liptove.",
				en: "Of course, we have authentic May bryndza directly from a sheep farm in Liptov.",
			},
			{
				who: "Zuzana",
				sk: "Výborne! Vezmem si dvestopäťdesiat gramov bryndze a jedno maslo.",
				en: "Great! I'll take two hundred and fifty grams of bryndza and one pack of butter.",
			},
			{ who: "Pani Kováčová", sk: "Ešte niečo ovocné alebo sladké?", en: "Anything fruity or sweet as well?" },
			{
				who: "Zuzana",
				sk: "Áno, prosím si štyri pekné červené jablká a pohár kvetového medu.",
				en: "Yes, I'd like four nice red apples and a jar of blossom honey, please.",
			},
			{
				who: "Pani Kováčová",
				sk: "Jablká sú od miestneho pestovateľa z nášho regiónu.",
				en: "The apples are from a local grower from our region.",
			},
			{
				who: "Zuzana",
				sk: "To je skvelé, rada podporujem našich domácich poľnohospodárov.",
				en: "That is great, I like supporting our domestic farmers.",
			},
			{
				who: "Pani Kováčová",
				sk: "Tu je všetko zabalené v papierovom vrecku.",
				en: "Here is everything packed in a paper bag.",
			},
			{
				who: "Zuzana",
				sk: "Ďakujem. Koľko vám dlhujem za celý nákup?",
				en: "Thank you. How much do I owe you for the whole shopping?",
			},
			{
				who: "Pani Kováčová",
				sk: "Spolu to je osem eur a štyridsať centov.",
				en: "Together that is eight euros and forty cents.",
			},
			{ who: "Zuzana", sk: "Platím kartou, ak je to možné.", en: "I pay by card if possible." },
			{
				who: "Pani Kováčová",
				sk: "Áno, priložte kartu k terminálu... Píp, platba prebehla úspešne.",
				en: "Yes, tap the card to the terminal... Beep, payment went through successfully.",
			},
			{
				who: "Zuzana",
				sk: "Ďakujem veľmi pekne a prajem vám pekný zvyšok dňa!",
				en: "Thank you very much and have a nice rest of the day!",
			},
		],
		newWords: [
			{ sk: "kváskový", en: "sourdough" },
			{ sk: "salaš", en: "sheep farm, alpine pasture" },
			{ sk: "pestovateľ", en: "grower, cultivator" },
			{ sk: "terminál", en: "payment terminal" },
		],
		questions: [
			{
				kind: "recall",
				q: "Odkiaľ pochádza bryndza, ktorú si Zuzana kúpila?",
				options: ["Z Bratislavy", "Zo salaša na Liptove", "Zo zahraničia"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Aké ovocie si Zuzana vybrala?",
				options: ["Banány", "Červené jablká", "Hrozno"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Ako Zuzana zaplatila za nákup?",
				options: ["V hotovosti", "Platobnou kartou", "Poukážkou"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-06-dom-a-zahrada",
		title: "Dom a záhrada",
		level: "A1",
		chapter: "home",
		genre: "travel",
		theme: "country house and orchard",
		topic: "Martin describes his grandparents' wooden country house and blooming garden",
		recap:
			"Martin visits his grandparents' stone-and-wood countryside home, walking through the fruit orchard and beehives.",
		cast: [{ name: "Martin", gender: "m", age: "young" }],
		sentences: [
			{
				who: "Martin",
				sk: "Keď chcem uniknúť z rušného mesta, idem k starým rodičom na dedinu.",
				en: "When I want to escape from the busy city, I go to my grandparents in the village.",
			},
			{
				who: "Martin",
				sk: "Ich dom je postavený z bieleho kameňa a tmavého smrekového dreva.",
				en: "Their house is built of white stone and dark spruce wood.",
			},
			{
				who: "Martin",
				sk: "Okolo domu rastie vysoký živý plot z divých ruží a hlohu.",
				en: "Around the house grows a tall hedge of wild roses and hawthorn.",
			},
			{
				who: "Martin",
				sk: "Za domom sa rozprestiera obrovská záhrada plná farieb a vôní.",
				en: "Behind the house spreads a huge garden full of colors and scents.",
			},
			{
				who: "Martin",
				sk: "V ovocnom sade rastú staré jablone, sladké hrušky a modré slivky.",
				en: "In the fruit orchard grow old apple trees, sweet pears and blue plums.",
			},
			{
				who: "Martin",
				sk: "Každú jar stromy nádherne zakvitnú bielymi a ružovými kvetmi.",
				en: "Every spring the trees blossom magnificently with white and pink flowers.",
			},
			{
				who: "Martin",
				sk: "V lete je tráva plná červených jahôd a žltých púpav.",
				en: "In summer the grass is full of red strawberries and yellow dandelions.",
			},
			{
				who: "Martin",
				sk: "Starý otec má v dolnej časti záhrady tri drevené úle.",
				en: "Grandfather has three wooden beehives in the lower part of the garden.",
			},
			{
				who: "Martin",
				sk: "Včely usilovne lietajú z kvetu na kvet a zbierajú nektár.",
				en: "Bees diligently fly from blossom to blossom collecting nectar.",
			},
			{
				who: "Martin",
				sk: "Ich tichý bzukot pôsobí veľmi upokojujúco.",
				en: "Their quiet buzzing feels very calming.",
			},
			{
				who: "Martin",
				sk: "V zeleninovej záhrade pestuje stará mama mrkvu, cibuľu, paradajky a cesnak.",
				en: "In the vegetable garden grandma grows carrots, onions, tomatoes and garlic.",
			},
			{
				who: "Martin",
				sk: "Zem je tu úrodná a zelenina chutí oveľa lepšie než z bežného obchodu.",
				en: "The soil here is fertile and the vegetables taste much better than from a normal shop.",
			},
			{
				who: "Martin",
				sk: "Popoludní radi sedávame na drevenej lavičke pod košatým orechom.",
				en: "In the afternoon we like sitting on the wooden bench under a bushy walnut tree.",
			},
			{
				who: "Martin",
				sk: "Stará mama prinesie kanvicu mätového čaju z čerstvo nazbieraných lístkov.",
				en: "Grandmother brings a pot of mint tea from freshly picked leaves.",
			},
			{
				who: "Martin",
				sk: "K čaju jeme krajec chleba natretý domácim slivkovým lekvárom.",
				en: "With tea we eat a slice of bread spread with homemade plum jam.",
			},
			{
				who: "Martin",
				sk: "Starý otec vyrezáva z lipového dreva malé figúrky zvierat.",
				en: "Grandfather carves small animal figures from linden wood.",
			},
			{
				who: "Martin",
				sk: "Učí ma, ako správne držať nožík a vnímať vôňu dreva.",
				en: "He teaches me how to hold the carving knife properly and perceive the scent of wood.",
			},
			{
				who: "Martin",
				sk: "Čas tu plynie oveľa pomalšie a prirodzeniejšie.",
				en: "Time flows much slower and more naturally here.",
			},
			{
				who: "Martin",
				sk: "Tento kúsok zeme je pre našu rodinu skutočným rajom pokoja.",
				en: "This piece of earth is a true paradise of peace for our family.",
			},
			{
				who: "Martin",
				sk: "Vždy odtiaľto odchádzam s čistou hlavou a plný novej energie.",
				en: "I always leave from here with a clear head and full of new energy.",
			},
		],
		newWords: [
			{ sk: "sad", en: "orchard" },
			{ sk: "včela", en: "bee" },
			{ sk: "lekvár", en: "thick fruit jam" },
			{ sk: "vyrezávať", en: "to carve (wood)" },
		],
		questions: [
			{
				kind: "recall",
				q: "Čo má starý otec v dolnej časti záhrady?",
				options: ["Bazén", "Tri drevené úle", "Skleník"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Pod akým stromom sedávajú popoludní?",
				options: ["Pod košatým orechom", "Pod starou lipou", "Pod vysokou jedľou"],
				answer: 0,
			},
			{
				kind: "gist",
				q: "Prečo Martin rád chodí do dediny?",
				options: ["Hľadá tam prácu", "Je to preňho miesto pokoja a novej energie", "Kupuje tam zeleninu"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-07-cesta-vlakom",
		title: "Cesta vlakom do Tatier",
		level: "A1",
		chapter: "travel",
		genre: "travel",
		theme: "train journey to the High Tatras",
		topic: "Matej and Martin take the morning train through Slovak valleys into the snowy mountains",
		recap: "Matej and Martin board the morning express train to Poprad, watching mountain peaks appear on the horizon.",
		cast: [
			{ name: "Matej", gender: "m", age: "young" },
			{ name: "Martin", gender: "m", age: "young" },
		],
		sentences: [
			{
				who: "Matej",
				sk: "V sobotu ráno sme sa s Martinom rozhodli vyraziť na výlet.",
				en: "On Saturday morning Martin and I decided to set out on a trip.",
			},
			{
				who: "Martin",
				sk: "Zbalili sme si turistické batohy, teplé bundy a pevnú obuv.",
				en: "We packed our hiking backpacks, warm jackets and sturdy shoes.",
			},
			{
				who: "Matej",
				sk: "Na železničnú stanicu sme prišli pol hodiny pred odchodom vlaku.",
				en: "We arrived at the railway station half an hour before the train's departure.",
			},
			{
				who: "Martin",
				sk: "V staničnej pokladnici som kúpil dva spiatočné lístky do Popradu.",
				en: "At the station ticket counter I bought two return tickets to Poprad.",
			},
			{
				who: "Matej",
				sk: "Vlakový rýchlik už stál pripravený na druhom nástupišti.",
				en: "The express train was already waiting ready on platform two.",
			},
			{
				who: "Martin",
				sk: "Nastúpili sme do moderného vozňa a našli sme si voľné miesta pri okne.",
				en: "We boarded the modern carriage and found vacant seats by the window.",
			},
			{
				who: "Matej",
				sk: "Ozval sa hlasný hvizd píšťalky a vlak sa plynulo pohol vpred.",
				en: "A loud whistle sounded and the train moved smoothly forward.",
			},
			{
				who: "Martin",
				sk: "Za oknom sa striedali zelené polia, lúky a pokojné slovenské dediny.",
				en: "Outside the window green fields, meadows and quiet Slovak villages alternated.",
			},
			{
				who: "Matej",
				sk: "Vlak prechádzal popri rieke Váh a popod starobylé zrúcaniny hradov.",
				en: "The train passed along the Váh river and beneath ancient castle ruins.",
			},
			{
				who: "Martin",
				sk: "Do kupé vstúpil usmievavý sprievodca v tmavej uniforme.",
				en: "A smiling conductor in a dark uniform entered the compartment.",
			},
			{
				who: "Matej",
				sk: "Predložili sme mu naše lístky a on ich rýchlo skontroloval a označil kliešťami.",
				en: "We presented our tickets to him and he quickly checked and stamped them.",
			},
			{
				who: "Martin",
				sk: "Poprial nám príjemnú cestu a pekný pobyt v horách.",
				en: "He wished us a pleasant journey and a nice stay in the mountains.",
			},
			{
				who: "Matej",
				sk: "Po dvoch hodinách jazdy sa na obzore zjavili Vysoké Tatry.",
				en: "After two hours of riding, the High Tatras appeared on the horizon.",
			},
			{
				who: "Martin",
				sk: "Ostré skalnaté štíty sa týčili vysoko k modrej oblohe.",
				en: "Sharp rocky peaks towered high towards the blue sky.",
			},
			{
				who: "Matej",
				sk: "Na najvyšších končiaroch ešte ležala tenká vrstva bieleho snehu.",
				en: "On the highest summits a thin layer of white snow still lay.",
			},
			{
				who: "Martin",
				sk: "Všetci cestujúci vo vlaku sa pozerali von a obdivovali tú nádheru.",
				en: "All passengers in the train looked outside and admired the splendor.",
			},
			{
				who: "Matej",
				sk: "Hlásateľ v reproduktore oznámil: 'Stanica Poprad-Tatry, konečná zastávka.'",
				en: "The announcer on the speaker proclaimed: 'Station Poprad-Tatry, final stop.'",
			},
			{
				who: "Martin",
				sk: "Vzali sme si batohy a vystúpili sme na perón do sviežeho horského vzduchu.",
				en: "We grabbed our backpacks and stepped onto the platform into crisp mountain air.",
			},
			{
				who: "Matej",
				sk: "Pred nami bol celý víkend plný dobrodružstva na tatranských chodníkoch.",
				en: "Before us lay an entire weekend full of adventure on Tatras trails.",
			},
			{
				who: "Martin",
				sk: "Cestovanie vlakom po Slovensku je naozaj pohodlné a krásne.",
				en: "Traveling by train through Slovakia is truly comfortable and beautiful.",
			},
		],
		newWords: [
			{ sk: "rýchlik", en: "express train" },
			{ sk: "sprievodca", en: "conductor, guide" },
			{ sk: "štít", en: "peak, shield" },
			{ sk: "nástupište", en: "platform" },
		],
		questions: [
			{
				kind: "recall",
				q: "Kam cestovali Matej a Martin vlakom?",
				options: ["Do Košíc", "Do Popradu", "Do Banskej Bystrice"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Popri akej rieke prechádzal vlak?",
				options: ["Popri Dunaji", "Popri Hrone", "Popri Váhu"],
				answer: 2,
			},
			{
				kind: "gist",
				q: "Čo videli chlapci z okna po dvoch hodinách cesty?",
				options: ["Bratislavský hrad", "Vysoké Tatry so zasneženými štítmi", "Jazero Domaša"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-08-sobotny-trh",
		title: "Sobotný trh na námestí",
		level: "A1",
		chapter: "shopping",
		genre: "dialogue",
		theme: "farmers market on town square",
		topic: "Elena and Zuzana explore the vibrant Saturday market stalls with local produce and crafts",
		recap:
			"Elena and Zuzana stroll among wooden stalls at the Saturday market, buying honey, fresh vegetables and handmade crafts.",
		cast: [
			{ name: "Elena", gender: "f", age: "adult" },
			{ name: "Zuzana", gender: "f", age: "young" },
		],
		sentences: [
			{
				who: "Elena",
				sk: "Sobota ráno je na našom námestí vždy najživším časom týždňa.",
				en: "Saturday morning on our square is always the liveliest time of the week.",
			},
			{
				who: "Zuzana",
				sk: "Áno, trh je plný ľudí, farieb a vône čerstvých plodov.",
				en: "Yes, the market is full of people, colors and the fragrance of fresh fruits.",
			},
			{
				who: "Elena",
				sk: "Poľnohospodári z okolitých dedín rozložili svoje drevené stánky.",
				en: "Farmers from surrounding villages set up their wooden stalls.",
			},
			{
				who: "Zuzana",
				sk: "Pozri sa na tie krásne prútené košíky a drevené varešky naľavo.",
				en: "Look at those beautiful wicker baskets and wooden spoons on the left.",
			},
			{
				who: "Elena",
				sk: "Tento starý majster pletie košíky z vŕbového prútia už celých päťdesiat rokov.",
				en: "This old master has been weaving baskets from willow twigs for a full fifty years.",
			},
			{
				who: "Zuzana",
				sk: "Poďme najprv ku stánku so včelími produktmi.",
				en: "Let's go first to the stall with bee products.",
			},
			{
				who: "Elena",
				sk: "Dobrý deň, pán včelár! Aký med nám dnes odporúčate?",
				en: "Hello, master beekeeper! What honey do you recommend to us today?",
			},
			{
				who: "Zuzana",
				sk: "Včelár nám ponúkol ochutnať tmavý lesný med na malej drevenej paličke.",
				en: "The beekeeper offered us a taste of dark forest honey on a small wooden stick.",
			},
			{
				who: "Elena",
				sk: "Tento med má bohatú chuť jedľového ihličia a bylín. Vezmem si dva poháre.",
				en: "This honey has a rich flavor of fir needles and herbs. I'll take two jars.",
			},
			{
				who: "Zuzana",
				sk: "A ja si kúpim túto sviečku zo žltého včelieho vosku, nádherne vonia.",
				en: "And I will buy this candle made of yellow beeswax, it smells wonderful.",
			},
			{
				who: "Elena",
				sk: "Teraz potrebujeme ešte čerstvú koreňovú zeleninu do nedeľnej polievky.",
				en: "Now we still need fresh root vegetables for Sunday soup.",
			},
			{
				who: "Zuzana",
				sk: "Pri ďalšom stánku predáva milá pani sladkú mrkvu, petržlen a veľký zeler.",
				en: "At the next stall a kind lady sells sweet carrots, parsley and large celeriac.",
			},
			{
				who: "Elena",
				sk: "Všetko je čerstvo vykopané z ornej zeme a očistené.",
				en: "Everything is freshly dug from the arable soil and cleaned.",
			},
			{
				who: "Zuzana",
				sk: "Kúpili sme aj viazaničku voňavého kôpru a mladú cibuľku.",
				en: "We also bought a bunch of fragrant dill and spring onions.",
			},
			{
				who: "Elena",
				sk: "Na rohu trhu hrá pouličný harmonikár veselé slovenské polky.",
				en: "On the corner of the market a street accordionist plays cheerful Slovak polkas.",
			},
			{
				who: "Zuzana",
				sk: "Ľudia sa zastavujú, tlieskajú a deti tancujú do rytmu.",
				en: "People stop, clap, and children dance to the rhythm.",
			},
			{
				who: "Elena",
				sk: "Trh nie je len miesto nákupu, ale aj miesto priateľských stretnutí.",
				en: "The market is not only a place to shop, but also a place for friendly gatherings.",
			},
			{
				who: "Zuzana",
				sk: "Stretla som tu dvoch bývalých spolužiakov a chvíľu sme sa porozprávali.",
				en: "I met two former classmates here and we talked for a while.",
			},
			{
				who: "Elena",
				sk: "Máme plné tašky poctivých potravín a dobrú náladu.",
				en: "We have bags full of honest groceries and a good mood.",
			},
			{
				who: "Zuzana",
				sk: "Niet lepšieho začiatku víkendu než dopoludnie na trhu.",
				en: "There is no better start to a weekend than a morning at the market.",
			},
		],
		newWords: [
			{ sk: "prútený", en: "wicker, woven" },
			{ sk: "včelár", en: "beekeeper" },
			{ sk: "kôpor", en: "dill" },
			{ sk: "harmonikár", en: "accordionist" },
		],
		questions: [
			{
				kind: "recall",
				q: "Aký med si kúpila Elena?",
				options: ["Svetlý agátový med", "Tmavý lesný med", "Repkový med"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Aký hudobný nástroj hral na rohu trhu?",
				options: ["Gitara", "Husle", "Harmonika"],
				answer: 2,
			},
			{
				kind: "gist",
				q: "Čo robí trh výnimočným okrem nákupu?",
				options: [
					"Je to miesto priateľských stretnutí a kultúry",
					"Dávajú tam jedlo zadarmo",
					"Predávajú tam iba knihy",
				],
				answer: 0,
			},
		],
	},
	{
		id: "a1-09-co-robim-cez-vikend",
		title: "Čo robím cez víkend",
		level: "A1",
		chapter: "routine",
		genre: "diary",
		theme: "weekend habits and outdoor rest",
		topic: "Matej details his weekend routines away from work, walking in the hills and resting",
		recap:
			"Matej describes how he disconnects on weekends, preparing breakfast, hiking in pine forests and reading by the window.",
		cast: [{ name: "Matej", gender: "m", age: "young" }],
		sentences: [
			{
				who: "Matej",
				sk: "Počas pracovného týždňa trávim veľa hodín pred monitorom počítača.",
				en: "During the work week I spend many hours in front of the computer monitor.",
			},
			{
				who: "Matej",
				sk: "Preto je pre mňa víkend časom, keď vypínam správy a hľadám pokoj.",
				en: "Therefore for me the weekend is a time when I turn off messages and seek peace.",
			},
			{
				who: "Matej",
				sk: "V sobotu ráno nezapínam budík a vstávam až vtedy, keď sa zobudím.",
				en: "On Saturday morning I do not set the alarm and get up only when I wake up naturally.",
			},
			{
				who: "Matej",
				sk: "Urobím si výdatné raňajky: praženicu s cibuľkou a bylinkový čaj s medom.",
				en: "I make a hearty breakfast: scrambled eggs with onion and herbal tea with honey.",
			},
			{
				who: "Matej",
				sk: "Okolo desiatej hodiny si obujem pohodlné tenisky a odídem do prírody.",
				en: "Around ten o'clock I put on comfortable sneakers and head into nature.",
			},
			{
				who: "Matej",
				sk: "Môj obľúbený chodník vedie cez borovicový les na vrch kopca Glanzenberg.",
				en: "My favorite trail leads through a pine forest to the top of Glanzenberg hill.",
			},
			{
				who: "Matej",
				sk: "Vzduch medzi stromami vonia živicou a suchým lístím.",
				en: "The air among the trees smells of pine resin and dry leaves.",
			},
			{
				who: "Matej",
				sk: "Po ceste sa napijem studenej vody z horského prameňa.",
				en: "Along the way I take a drink of cold water from a mountain spring.",
			},
			{
				who: "Matej",
				sk: "Z vrcholu kopca je nádherný kruhový výhľad na celú kotlinu a tajchy.",
				en: "From the top of the hill there is a magnificent circular view of the whole basin and reservoirs.",
			},
			{
				who: "Matej",
				sk: "Sadnem si na vyhriaty kameň a len tak pozorujem oblaky na oblohe.",
				en: "I sit down on a sun-warmed stone and simply watch the clouds in the sky.",
			},
			{
				who: "Matej",
				sk: "Popoludní sa vraciam domov, osprchujem sa a uvarím si ľahký obed.",
				en: "In the afternoon I return home, take a shower and cook a light lunch.",
			},
			{
				who: "Matej",
				sk: "V sobotu večer rád čítam slovenské historické romány alebo pozerám dobrý film.",
				en: "On Saturday evening I like reading Slovak historical novels or watching a good film.",
			},
			{ who: "Matej", sk: "Nedeľa patrí rodine a priateľom.", en: "Sunday belongs to family and friends." },
			{
				who: "Matej",
				sk: "Často navštívim rodičov alebo si zájdem so Zuzanou a Martinom na kávu.",
				en: "I often visit parents or go for coffee with Zuzana and Martin.",
			},
			{
				who: "Matej",
				sk: "Spoločne sa prechádzame historickými uličkami a plánujeme ďalšie výlety.",
				en: "Together we stroll through historical streets and plan further trips.",
			},
			{
				who: "Matej",
				sk: "V nedeľu večer si poupratujem pracovný stôl a pripravím oblečenie na pondelok.",
				en: "On Sunday evening I tidy up my desk and prepare clothes for Monday.",
			},
			{
				who: "Matej",
				sk: "Napíšem si do zošita tri dôležité ciele na nadchádzajúci týždeň.",
				en: "I write down three important goals for the upcoming week in my notebook.",
			},
			{
				who: "Matej",
				sk: "Idem spať skoro, aby som mal v pondelok ráno čistú myseľ a dostatok síl.",
				en: "I go to bed early so that I have a clear mind and plenty of strength on Monday morning.",
			},
			{
				who: "Matej",
				sk: "Rovnováha medzi prácou a oddychom je kľúčom k zdravému životu.",
				en: "Balance between work and rest is the key to a healthy life.",
			},
			{
				who: "Matej",
				sk: "Každý víkend mi pripomenie, aký krásny a vzácny je obyčajný život.",
				en: "Every weekend reminds me how beautiful and precious ordinary life is.",
			},
		],
		newWords: [
			{ sk: "praženica", en: "scrambled eggs" },
			{ sk: "živica", en: "resin" },
			{ sk: "prameň", en: "water spring, source" },
			{ sk: "rovnováha", en: "balance, equilibrium" },
		],
		questions: [
			{
				kind: "recall",
				q: "Kam chodí Matej v sobotu na prechádzku?",
				options: ["Do nákupného centra", "Cez borovicový les na kopec Glanzenberg", "Na kúpalisko"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Čo si pripravuje Matej na raňajky v sobotu?",
				options: ["Praženicu s cibuľkou a bylinkový čaj", "Pečivo so syrom", "Ovsenú kašu"],
				answer: 0,
			},
			{
				kind: "gist",
				q: "Prečo je pre Mateja víkend dôležitý?",
				options: ["Aby zarobil viac peňazí", "Aby našiel pokoj a rovnováhu po práci", "Pretože nemusí variť"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-10-obed-v-kolibe",
		title: "Obed v tradičnej kolibe",
		level: "A1",
		chapter: "food",
		genre: "dialogue",
		theme: "traditional sheep farm restaurant",
		topic: "Matej and Zuzana dine at an authentic wooden koliba with bryndzové halušky and žinčica",
		recap:
			"Matej and Zuzana stop at a rustic mountain koliba with a stone hearth, enjoying hot bryndzové halušky with bacon.",
		cast: [
			{ name: "Matej", gender: "m", age: "young" },
			{ name: "Zuzana", gender: "f", age: "young" },
			{ name: "Čašníčka", gender: "f", age: "adult" },
		],
		sentences: [
			{
				who: "Matej",
				sk: "Po dlhej túre cez lúky sme s vyhladovanými žalúdkami prišli ku kolibe.",
				en: "After a long hike across meadows we arrived at the koliba with starved stomachs.",
			},
			{
				who: "Zuzana",
				sk: "Táto drevená koliba vyzerá presne ako zo starých slovenských rozprávok.",
				en: "This wooden chalet looks exactly like from old Slovak fairy tales.",
			},
			{
				who: "Matej",
				sk: "Vnútri v kamennom krbe praská suché bukové drevo a hreje celú miestnosť.",
				en: "Inside dry beech wood crackles in the stone fireplace and warms the entire room.",
			},
			{
				who: "Čašníčka",
				sk: "Pekne vás vítam v našej kolibe! Sadnite si k tomuto voľnému stolu pri okne.",
				en: "A warm welcome to our koliba! Take a seat at this empty table by the window.",
			},
			{
				who: "Zuzana",
				sk: "Ďakujeme pekne. Lavice sú pokryté teplou ovčou kožušinou, je to veľmi pohodlné.",
				en: "Thank you nicely. The benches are covered in warm sheepskin, it is very comfortable.",
			},
			{
				who: "Čašníčka",
				sk: "Čo vám môžem priniesť na pitie po horskej túre?",
				en: "What can I bring you to drink after your mountain hike?",
			},
			{ who: "Matej", sk: "Máte čerstvú žinčicu zo salaša?", en: "Do you have fresh žinčica from the sheep farm?" },
			{
				who: "Čašníčka",
				sk: "Máme sladkú aj kyslú, vychladenú v hlinenom džbáne.",
				en: "We have both sweet and sour, chilled in an earthenware jug.",
			},
			{
				who: "Matej",
				sk: "Ja si dám jeden pohár kyslej žinčice a Zuzana si prosí čistú pramenitú vodu.",
				en: "I'll have one glass of sour žinčica and Zuzana requests pure spring water.",
			},
			{ who: "Čašníčka", sk: "A aké jedlo si vyberiete na obed?", en: "And what food will you choose for lunch?" },
			{
				who: "Zuzana",
				sk: "Ja by som si veľmi rada dala pravé bryndzové halušky so slaninkou.",
				en: "I would very much like to have authentic bryndza dumplings with bacon.",
			},
			{
				who: "Matej",
				sk: "A ja si prosím pečené zemiakové pirohy plnené bryndzou a posypané opraženou cibuľkou.",
				en: "And I'd like baked potato pockets filled with bryndza and sprinkled with sautéed onion.",
			},
			{
				who: "Čašníčka",
				sk: "Výborná voľba, obe jedlá pripravuje náš bača podľa starého rodinného receptu.",
				en: "Excellent choice, both dishes are prepared by our shepherd according to an old family recipe.",
			},
			{
				who: "Zuzana",
				sk: "Už sa neviem dočkať, vôňa pečenej slaninky z kuchyne je neodolateľná.",
				en: "I can't wait, the aroma of baked bacon from the kitchen is irresistible.",
			},
			{
				who: "Čašníčka",
				sk: "Nech sa páči, tu sú horúce halušky a pirohy. Dobrú chuť vám prajem!",
				en: "Here you are, here are hot dumplings and pirohy. Enjoy your meal!",
			},
			{
				who: "Matej",
				sk: "Halušky sú úžasne krémové a slaninka je chrumkavá a voňavá.",
				en: "The dumplings are wonderfully creamy and the bacon is crispy and fragrant.",
			},
			{
				who: "Zuzana",
				sk: "Moje pirohy sú mäkučké a smotana im dodáva jemnú chuť.",
				en: "My pirohy are so soft and sour cream gives them a delicate flavor.",
			},
			{
				who: "Matej",
				sk: "Tradičná slovenská kuchyňa je jednoduchá, ale neskutočne sýta a chutná.",
				en: "Traditional Slovak cuisine is simple, but incredibly filling and tasty.",
			},
			{
				who: "Zuzana",
				sk: "Zjedli sme všetko do posledného sústa, tanier je úplne prázdny.",
				en: "We ate everything down to the last bite, the plate is completely empty.",
			},
			{
				who: "Matej",
				sk: "Po takomto poctivom obede máme dosť energie na celú cestu domov.",
				en: "After such an honest lunch we have plenty of energy for the whole way home.",
			},
		],
		newWords: [
			{ sk: "koliba", en: "traditional shepherd's chalet/restaurant" },
			{ sk: "žinčica", en: "boiled sheep whey drink" },
			{ sk: "bača", en: "chief shepherd" },
			{ sk: "chrumkavý", en: "crispy, crunchy" },
		],
		questions: [
			{
				kind: "recall",
				q: "Aké jedlo si objednala Zuzana?",
				options: ["Guláš", "Bryndzové halušky so slaninkou", "Pečené kura"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Čo si dal Matej na pitie?",
				options: ["Pivo", "Kyslú žinčicu", "Jablkový džús"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "Čím je zariadená a zateplená koliba?",
				options: ["Kamenným krbom a ovčími kožušinami", "Elektrickým krbom", "Plastovými stoličkami"],
				answer: 0,
			},
		],
	},
	{
		id: "a1-11-rocne-obdobia",
		title: "Štyri ročné obdobia na Slovensku",
		level: "A1",
		chapter: "calendar",
		genre: "diary",
		theme: "seasons and climate cycle",
		topic: "Matej reflects on spring blooms, summer swims, golden autumn forests and winter snow",
		recap:
			"Matej describes how nature transforms across the four seasons in Slovakia, from spring meadows to winter snow in the Tatras.",
		cast: [{ name: "Matej", gender: "m", age: "young" }],
		sentences: [
			{
				who: "Matej",
				sk: "Slovensko má štyri ročné obdobia a každé z nich prináša jedinečnú krásu.",
				en: "Slovakia has four seasons and each of them brings unique beauty.",
			},
			{
				who: "Matej",
				sk: "Jar prichádza v marci, keď sa sneh začína topiť na horských lúkach.",
				en: "Spring arrives in March when snow begins to melt on mountain meadows.",
			},
			{
				who: "Matej",
				sk: "V lesoch kvitnú prvé snežienky, fialky a žlté podbele.",
				en: "In forests the first snowdrops, violets and yellow coltsfoot bloom.",
			},
			{
				who: "Matej",
				sk: "Dni sa predlžujú, slnko hreje silnejšie a vtáky sa vracajú z teplých krajín.",
				en: "Days grow longer, the sun warms stronger and birds return from warm lands.",
			},
			{
				who: "Matej",
				sk: "V júni sa začína horúce leto a školáci sa tešia na prázdniny.",
				en: "In June hot summer begins and schoolchildren look forward to vacations.",
			},
			{
				who: "Matej",
				sk: "Letné dni sú dlhé, plné slnka, dozrievajúcich čerešní a voňavého sena.",
				en: "Summer days are long, full of sunshine, ripening cherries and fragrant hay.",
			},
			{
				who: "Matej",
				sk: "Ľudia radi plávajú v prírodných jazerách, stanujú pri vode a opekajú špekáčiky pri táboráku.",
				en: "People like swimming in natural lakes, camping by the water and roasting sausages by the campfire.",
			},
			{
				who: "Matej",
				sk: "V septembri prichádza tichá jeseň a príroda mení svoj šat.",
				en: "In September quiet autumn arrives and nature changes its attire.",
			},
			{
				who: "Matej",
				sk: "Bukové a dubové lesy sa sfarbia do zlatej, medenej a ohnivej červenej farby.",
				en: "Beech and oak forests color into golden, copper and fiery red color.",
			},
			{
				who: "Matej",
				sk: "Na poliach dozrievajú tekvice a vinohradníci zberajú sladké hrozno.",
				en: "Pumpkins ripen in fields and winemakers harvest sweet grapes.",
			},
			{
				who: "Matej",
				sk: "Rána bývajú hmlisté a chladné, ale popoludňajšie jesenné slnko je príjemné.",
				en: "Mornings tend to be misty and cold, but the afternoon autumn sun is pleasant.",
			},
			{
				who: "Matej",
				sk: "V decembri zahalí celú krajinu skutočná zima.",
				en: "In December true winter envelops the entire country.",
			},
			{
				who: "Matej",
				sk: "Mestá a dediny prikryje hrubá perina bieleho snehu.",
				en: "A thick duvet of white snow covers towns and villages.",
			},
			{
				who: "Matej",
				sk: "Deti sa sánkujú na svahoch a stavajú snehuliakov v záhradách.",
				en: "Children sled down slopes and build snowmen in gardens.",
			},
			{
				who: "Matej",
				sk: "V horách sa otvárajú lyžiarske strediská a milovníci zimných športov obúvajú lyže.",
				en: "In mountains ski resorts open and winter sports lovers put on skis.",
			},
			{
				who: "Matej",
				sk: "Večer sedíme v teple domova, pijeme horúci čaj a tešíme sa na Vianoce.",
				en: "In the evening we sit in the warmth of home, drink hot tea and look forward to Christmas.",
			},
			{
				who: "Matej",
				sk: "Vianočné trhy v mestách voňajú škoricou, pečenými gaštanmi a punčom.",
				en: "Christmas markets in towns smell of cinnamon, roasted chestnuts and punch.",
			},
			{
				who: "Matej",
				sk: "Každé obdobie má svoj prirodzený rytmus, prácu aj sviatky.",
				en: "Each season has its natural rhythm, work as well as holidays.",
			},
			{
				who: "Matej",
				sk: "Neviem si predstaviť život na mieste, kde sa ročné obdobia nemenia.",
				en: "I cannot imagine life in a place where seasons do not change.",
			},
			{
				who: "Matej",
				sk: "Tento večný cyklus prírody mi dáva pocit istoty a pokoja.",
				en: "This eternal cycle of nature gives me a sense of certainty and peace.",
			},
		],
		newWords: [
			{ sk: "snežienka", en: "snowdrop (flower)" },
			{ sk: "vinohradník", en: "winemaker, viticulturist" },
			{ sk: "perina", en: "duvet, feather blanket" },
			{ sk: "cyklus", en: "cycle" },
		],
		questions: [
			{ kind: "recall", q: "Kedy prichádza na Slovensko jar?", options: ["V januári", "V marci", "V máji"], answer: 1 },
			{
				kind: "detail",
				q: "Do akých farieb sa sfarbia lesy na jeseň?",
				options: ["Do bielej", "Do modrej a zelenej", "Do zlatej, medenej a červenej"],
				answer: 2,
			},
			{
				kind: "gist",
				q: "Čo prináša zima podľa Mateja?",
				options: ["Sneh, sánkovanie, lyžovanie a vianočné trhy", "Iba dážď a tmu", "Horúce počasie"],
				answer: 0,
			},
		],
	},
	{
		id: "a1-12-u-starej-mamy",
		title: "Návšteva u starej mamy",
		level: "A1",
		chapter: "family",
		genre: "dialogue",
		theme: "visiting grandmother in the country",
		topic: "Lucia visits her grandmother in Hrušov, baking braided apple pie and looking at family albums",
		recap:
			"Lucia takes the country bus to visit grandmother Mária, learning her traditional braided apple pie recipe and listening to stories.",
		cast: [
			{ name: "Lucia", gender: "f", age: "young" },
			{ name: "Stará mama", gender: "f", age: "old" },
		],
		sentences: [
			{
				who: "Lucia",
				sk: "V sobotu ráno som nasadla na autobus do malej dedinky Hrušov.",
				en: "On Saturday morning I boarded the bus to the small village of Hrušov.",
			},
			{
				who: "Lucia",
				sk: "Veľmi som sa tešila na návštevu mojej milovanej starej mamy Márie.",
				en: "I was looking forward very much to visiting my beloved grandmother Mária.",
			},
			{
				who: "Stará mama",
				sk: "Lucinka moja, vitaj! Už som ťa netrpezlivo čakala pri bráničke.",
				en: "My Lucinka, welcome! I was already waiting impatiently for you at the little gate.",
			},
			{
				who: "Lucia",
				sk: "Ahoj, stará mama! Doniesla som ti čerstvú kávu a teplý šál z ovčej vlny.",
				en: "Hi, grandma! I brought you fresh coffee and a warm scarf made of sheep wool.",
			},
			{
				who: "Stará mama",
				sk: "Ďakujem ti, dievčatko moje. Poď dnu, v peci už horí oheň a v kuchyni je teplo.",
				en: "Thank you, my little girl. Come inside, the fire is already burning in the stove and it is warm in the kitchen.",
			},
			{
				who: "Lucia",
				sk: "Kuchyňa vonia po škorici a vanilkovom cukre. Čo to dobré pripravuješ?",
				en: "The kitchen smells of cinnamon and vanilla sugar. What good thing are you preparing?",
			},
			{
				who: "Stará mama",
				sk: "Pripravila som krehké kysnuté cesto na tradičný pletený jablkový koláč.",
				en: "I prepared delicate yeast dough for a traditional braided apple pie.",
			},
			{
				who: "Lucia",
				sk: "Môžem ti pomôcť s pečením? Veľmi sa chcem naučiť tvoj recept.",
				en: "May I help you with baking? I really want to learn your recipe.",
			},
			{
				who: "Stará mama",
				sk: "Pravdaže! Tu máš nožík, ošúp tieto červené jablká a nastrúhaj ich na strúhadle.",
				en: "Of course! Here is a knife, peel these red apples and grate them on the grater.",
			},
			{
				who: "Lucia",
				sk: "Pridáme do jabĺk aj mletú škoricu a posekané vlašské orechy zo záhrady?",
				en: "Shall we add ground cinnamon and chopped walnuts from the garden to the apples too?",
			},
			{
				who: "Stará mama",
				sk: "Presne tak, orechy dodajú plnke úžasnú chuť a chrumkavosť.",
				en: "Exactly, walnuts will add wonderful flavor and crunchiness to the filling.",
			},
			{
				who: "Lucia",
				sk: "Spoločne sme rozvaľkali cesto, naplnili ho jablkami a zaplietli do vrkoča.",
				en: "Together we rolled out the dough, filled it with apples and braided it into a plait.",
			},
			{
				who: "Stará mama",
				sk: "Potrieme vrch rozšľahaným vajíčkom, aby mal koláč v peci krásnu zlatú kôrku.",
				en: "We brush the top with beaten egg so that the pie gets a beautiful golden crust in the oven.",
			},
			{
				who: "Lucia",
				sk: "Kým sa koláč pomaly piekol, stará mama uvarila voňavý harmančekový čaj.",
				en: "While the pie was slowly baking, grandma brewed fragrant chamomile tea.",
			},
			{
				who: "Stará mama",
				sk: "Vybrala zo skrine starý rodinný fotoalbum viazaný v koži.",
				en: "She took an old family photo album bound in leather from the cupboard.",
			},
			{
				who: "Lucia",
				sk: "Pozerali sme čiernobiele fotografie pradeda a prastarej mamy v krojoch.",
				en: "We looked at black-and-white photos of great-grandfather and great-grandmother in folk costumes.",
			},
			{
				who: "Stará mama",
				sk: "Rozprávala mi príbehy o tom, ako sa kedysi žilo bez áut a elektriny.",
				en: "She told me stories about how people once lived without cars and electricity.",
			},
			{
				who: "Lucia",
				sk: "Z rúry sa začala šíriť neodolateľná vôňa upečeného koláča.",
				en: "An irresistible aroma of baked pie began spreading from the oven.",
			},
			{
				who: "Stará mama",
				sk: "Vybrali sme horúci koláč, posypali ho práškovým cukrom a odkrojili prvé kúsky.",
				en: "We took out the hot pie, dusted it with powdered sugar and cut the first slices.",
			},
			{
				who: "Lucia",
				sk: "Koláč bol dokonalý: cesto mäkké ako perie a plnka šťavnatá a sladká.",
				en: "The pie was perfect: dough soft as feathers and the filling juicy and sweet.",
			},
		],
		newWords: [
			{ sk: "cesto", en: "dough, batter" },
			{ sk: "vrkoč", en: "braid, plait" },
			{ sk: "kroj", en: "traditional folk costume" },
			{ sk: "práškový", en: "powdered (sugar)" },
		],
		questions: [
			{
				kind: "recall",
				q: "Čo piekla Lucia so starou mamou?",
				options: ["Čokoládovú tortu", "Pletený jablkový koláč so škoricou", "Slivkové buchty"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Čo si prezerali, kým sa koláč piekol?",
				options: ["Starý rodinný fotoalbum", "Noviny a časopisy", "Kuchársku knihu"],
				answer: 0,
			},
			{
				kind: "gist",
				q: "Ako sa Lucia cítila u starej mamy?",
				options: ["Nudila sa", "Cítila teplo, lásku a rodinné puto", "Ponáhľala sa preč"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-13-novy-byt",
		title: "Náš nový byt",
		level: "A1",
		chapter: "home",
		genre: "dialogue",
		theme: "showing a new apartment",
		topic: "Zuzana shows Matej her newly rented bright apartment with a balcony view",
		recap:
			"Zuzana welcomes Matej into her newly renovated sunny apartment in Bratislava, showing the kitchen, library, and scenic balcony.",
		cast: [
			{ name: "Zuzana", gender: "f", age: "young" },
			{ name: "Matej", gender: "m", age: "young" },
		],
		sentences: [
			{
				who: "Zuzana",
				sk: "Poď ďalej, Matej! Vitaj v mojom novom bratislavskom byte.",
				en: "Come on in, Matej! Welcome to my new Bratislava apartment.",
			},
			{
				who: "Matej",
				sk: "Ďakujem za pozvanie, Zuzka! V predsieni je príjemne teplo a svetlo.",
				en: "Thank you for the invitation, Zuzka! It is pleasantly warm and bright in the hallway.",
			},
			{
				who: "Zuzana",
				sk: "Zlož si kabát na vešiak a vezmi si pohodlné domáce papuče.",
				en: "Hang your coat on the hanger and take comfortable home slippers.",
			},
			{
				who: "Matej",
				sk: "Wau, obývacia izba je naozaj priestranná a má vysoké stropy!",
				en: "Wow, the living room is really spacious and has high ceilings!",
			},
			{
				who: "Zuzana",
				sk: "Áno, tento starý tehlový dom má veľké okná orientované na juhovýchod.",
				en: "Yes, this old brick house has large windows facing southeast.",
			},
			{
				who: "Matej",
				sk: "Slnko sem krásne svieti a osvetľuje drevené parkety.",
				en: "The sun shines in beautifully here and illuminates the wooden parquet floors.",
			},
			{
				who: "Zuzana",
				sk: "Sedačku som vybrala v tmavomodrej farbe a pred ňu som dala nízky dubový stôl.",
				en: "I picked the couch in dark blue color and put a low oak table in front of it.",
			},
			{
				who: "Matej",
				sk: "Vidím, že tvoja knižnica pri stene je už takmer plná kníh.",
				en: "I see that your bookcase against the wall is already almost full of books.",
			},
			{
				who: "Zuzana",
				sk: "Knihy sú moja vášeň, bez nich by to pre mňa nebol skutočný domov.",
				en: "Books are my passion, without them it wouldn't be a true home for me.",
			},
			{ who: "Matej", sk: "Poďme sa pozrieť aj do kuchyne.", en: "Let's take a look in the kitchen too." },
			{
				who: "Zuzana",
				sk: "Kuchyňa je spojená s jedálenským kútom. Mám tu indukčnú dosku a novú chladničku.",
				en: "The kitchen is connected with the dining nook. I have an induction cooktop here and a new fridge.",
			},
			{
				who: "Matej",
				sk: "Páči sa mi táto polica s koreničkami a čerstvými bylinkami v črepníkoch.",
				en: "I like this shelf with spice jars and fresh herbs in flowerpots.",
			},
			{
				who: "Zuzana",
				sk: "Pestujem tu bazalku, rozmarín a mätu na čerstvý čaj.",
				en: "I grow basil, rosemary and mint here for fresh tea.",
			},
			{ who: "Matej", sk: "A čo je za týmito sklenenými dverami?", en: "And what is behind these glass doors?" },
			{
				who: "Zuzana",
				sk: "To je môj obľúbený kútik – balkón s výhľadom na mestský park.",
				en: "That is my favorite nook – a balcony with a view of the city park.",
			},
			{
				who: "Matej",
				sk: "Odtiaľto z piateho poschodia vidno koruny starých líp a v diaľke aj Bratislavský hrad!",
				en: "From here on the fifth floor one can see the crowns of old linden trees and in the distance even Bratislava Castle!",
			},
			{
				who: "Zuzana",
				sk: "Kúpila sa sem dve prútené kreslá a malý stolík na rannú kávu.",
				en: "I bought two wicker armchairs here and a small table for morning coffee.",
			},
			{
				who: "Matej",
				sk: "Je tu prekvapivý pokoj, hoci sme len kúsok od rušného centra.",
				en: "There is surprising peace here, even though we are just a short walk from the busy center.",
			},
			{
				who: "Zuzana",
				sk: "Cítim sa tu veľmi šťastná a konečne mám miesto, kde môžem tvoriť a oddychovať.",
				en: "I feel very happy here and finally have a place where I can create and rest.",
			},
			{
				who: "Matej",
				sk: "Gratulujem ti k novému domovu, Zuzka! Nech sa ti tu výborne býva.",
				en: "Congratulations on your new home, Zuzka! May you live wonderfully here.",
			},
		],
		newWords: [
			{ sk: "papuče", en: "slippers" },
			{ sk: "parkety", en: "parquet flooring" },
			{ sk: "črepník", en: "flowerpot" },
			{ sk: "kútik", en: "nook, cozy corner" },
		],
		questions: [
			{
				kind: "recall",
				q: "Akej farby je nová sedačka v obývačke?",
				options: ["Sivá", "Tmavomodrá", "Zelená"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Čo vidno z balkóna na piatom poschodí?",
				options: ["Len rušnú cestu", "Mestský park a Bratislavský hrad v diaľke", "Železničnú stanicu"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "Aké bylinky pestuje Zuzana v kuchyni?",
				options: ["Bazalku, rozmarín a mätu", "Iba petržlen", "Žiadne bylinky nepestuje"],
				answer: 0,
			},
		],
	},
	{
		id: "a1-14-hladame-cestu",
		title: "Hľadáme cestu v meste",
		level: "A1",
		chapter: "town",
		genre: "dialogue",
		theme: "asking for directions in town",
		topic: "Martin asks a polite local gentleman the way through Trnava's historic streets to Trinity Square",
		recap:
			"Martin arrives in historic Trnava, asking a helpful local resident for directions to the concert hall on the main square.",
		cast: [
			{ name: "Martin", gender: "m", age: "young" },
			{ name: "Miestny pán", gender: "m", age: "old" },
		],
		sentences: [
			{
				who: "Martin",
				sk: "Práve som vystúpil z vlaku v historickom meste Trnava.",
				en: "I just stepped off the train in the historical city of Trnava.",
			},
			{
				who: "Martin",
				sk: "Mám tu dnes večer hrať na gitare na hudobnom festivale.",
				en: "I am supposed to play guitar here tonight at a music festival.",
			},
			{
				who: "Martin",
				sk: "Môj mobilný telefón sa však vybil a papierovú mapu som nechal doma.",
				en: "My mobile phone ran out of battery, however, and I left the paper map at home.",
			},
			{
				who: "Martin",
				sk: "Na rohu ulice vidím staršieho pána v sivom klobúku, ktorý číta knihu.",
				en: "On the street corner I see an elderly gentleman in a gray hat reading a book.",
			},
			{
				who: "Martin",
				sk: "Prepáčte, prosím vás, pane! Môžete mi pomôcť nájsť cestu?",
				en: "Excuse me, please, sir! Can you help me find the way?",
			},
			{
				who: "Miestny pán",
				sk: "Dobrý deň, mladý muž. Samozrejme, veľmi rád. Čo konkrétne hľadáte?",
				en: "Good day, young man. Of course, gladly. What specifically are you looking for?",
			},
			{
				who: "Martin",
				sk: "Hľadám Trojičné námestie a starú koncertnú sálu radnice.",
				en: "I am looking for Trinity Square and the old concert hall of the town hall.",
			},
			{
				who: "Miestny pán",
				sk: "Nie ste odtiaľto ďaleko, je to asi desať minút pohodlnej chôdze.",
				en: "You are not far from here, it is about ten minutes of comfortable walking.",
			},
			{ who: "Martin", sk: "Ako sa tam najlepšie dostanem pešo?", en: "How do I best get there on foot?" },
			{
				who: "Miestny pán",
				sk: "Choďte rovno po tejto širokej aleji popri mestských hradbách.",
				en: "Go straight along this wide avenue along the city fortifications.",
			},
			{ who: "Martin", sk: "A kde mám potom odbočiť?", en: "And where should I turn afterwards?" },
			{
				who: "Miestny pán",
				sk: "Na prvej svetelnej križovatke prejdite cez priechod pre chodcov a zabočte doprava.",
				en: "At the first traffic light intersection cross the pedestrian crossing and turn right.",
			},
			{ who: "Martin", sk: "Doprava, dobre si to pamätám.", en: "Right, I remember it well." },
			{
				who: "Miestny pán",
				sk: "Vojdete na pešiu zónu s dlažobnými kockami a starými meštianskymi domami.",
				en: "You will enter a pedestrian zone with cobblestone pavers and old burgher houses.",
			},
			{
				who: "Martin",
				sk: "Bude tam už vidieť nejakú dominantu mesta?",
				en: "Will some landmark of the town already be visible there?",
			},
			{
				who: "Miestny pán",
				sk: "Áno, rovno pred sebou uvidíte vysokú renesančnú Mestskú vežu.",
				en: "Yes, directly in front of you you will see the tall Renaissance City Tower.",
			},
			{
				who: "Martin",
				sk: "A pri Mestskej veži je už hľadané námestie?",
				en: "And is the square I seek right by the City Tower?",
			},
			{
				who: "Miestny pán",
				sk: "Presne tak, námestie sa rozprestiera priamo pod ňou a radnica je po ľavej strane.",
				en: "Exactly, the square spreads directly beneath it and the town hall is on the left side.",
			},
			{
				who: "Martin",
				sk: "Ďakujem vám z celého srdca za vašu ochotu a presné vysvetlenie!",
				en: "Thank you with all my heart for your willingness and accurate explanation!",
			},
			{
				who: "Miestny pán",
				sk: "Nemáte za čo, chlapče. Želám vám krásny umelecký zážitok v našom malom Ríme!",
				en: "Don't mention it, boy. I wish you a wonderful artistic experience in our Little Rome!",
			},
		],
		newWords: [
			{ sk: "priechod", en: "pedestrian crossing" },
			{ sk: "dlažobný", en: "cobblestone, paving (adj)" },
			{ sk: "meštiansky", en: "burgher, bourgeois" },
			{ sk: "ochota", en: "willingness, kindness" },
		],
		questions: [
			{
				kind: "recall",
				q: "Kam potrebuje Martin prísť?",
				options: ["Na Trojičné námestie do koncertnej sály", "Na autobusovú stanicu", "Do nemocnice"],
				answer: 0,
			},
			{
				kind: "detail",
				q: "Akú dominantu uvidí Martin na pešej zóne?",
				options: ["Vysoký most", "Renesančnú Mestskú vežu", "Televíznu vežu"],
				answer: 1,
			},
			{
				kind: "detail",
				q: "Ako pán nazval mesto Trnava na rozlúčku?",
				options: ["Zlaté mesto", "Náš malý Rím", "Perla severu"],
				answer: 1,
			},
		],
	},
	{
		id: "a1-15-vecer-s-priatelmi",
		title: "Pekný večer s priateľmi",
		level: "A1",
		chapter: "hello",
		genre: "dialogue",
		theme: "friendly evening gathering",
		topic: "Matej, Zuzana and Martin celebrate the end of a busy week at a quiet historic bistro",
		recap:
			"Matej, Zuzana and Martin gather on Friday evening at the bistro 'Starý dvor', sharing tea, board games and fond memories.",
		cast: [
			{ name: "Matej", gender: "m", age: "young" },
			{ name: "Zuzana", gender: "f", age: "young" },
			{ name: "Martin", gender: "m", age: "young" },
		],
		sentences: [
			{
				who: "Matej",
				sk: "Konečne prišiel piatok večer a týždeň plný pracovných povinností sa skončil.",
				en: "Finally Friday evening came and the week full of work duties ended.",
			},
			{
				who: "Zuzana",
				sk: "Veľmi som sa tešila, kedy si spoločne sadneme a vydýchneme si.",
				en: "I was looking forward so much to sitting down together and catching our breath.",
			},
			{
				who: "Martin",
				sk: "Vybral som naše obľúbené malé bistro Starý dvor v tichej bočnej uličke.",
				en: "I chose our favorite small bistro Old Courtyard on a quiet side alley.",
			},
			{
				who: "Matej",
				sk: "Tento stôl pri klenbovom okne s horiacimi sviečkami je nádherný.",
				en: "This table by the arched window with burning candles is wonderful.",
			},
			{
				who: "Zuzana",
				sk: "Čašník nám priniesol džbán vody s mätou a jedálne lístky.",
				en: "The waiter brought us a pitcher of water with mint and the menus.",
			},
			{
				who: "Martin",
				sk: "Ja si dám horúci lipový čaj s medom a citrónom.",
				en: "I will have hot linden tea with honey and lemon.",
			},
			{
				who: "Zuzana",
				sk: "Ja si prosím hustú horúcu čokoládu s domácou šľahačkou.",
				en: "I'd like thick hot chocolate with homemade whipped cream, please.",
			},
			{
				who: "Matej",
				sk: "A ja si vezmem bylinkový čaj a tanier pečených zemiakov s cesnakovým dipom pre všetkých.",
				en: "And I will take herbal tea and a plate of baked potatoes with garlic dip for everyone.",
			},
			{
				who: "Martin",
				sk: "Povedzte, ako sa vám darilo tento týždeň v práci?",
				en: "Tell me, how did you do at work this week?",
			},
			{
				who: "Zuzana",
				sk: "V kníhkupectve sme mali autorské čítanie novej knihy a prišlo vyše päťdesiat ľudí.",
				en: "In the bookstore we had an author reading of a new book and over fifty people came.",
			},
			{
				who: "Matej",
				sk: "Ja som dokončil grafický návrh plagátu pre jesenný divadelný festival.",
				en: "I finished the graphic poster design for the autumn theater festival.",
			},
			{
				who: "Martin",
				sk: "A moji malí žiaci v hudobnej škole zvládli zahrať svoju prvú spoločnú pieseň na gitare.",
				en: "And my young pupils at the music school managed to play their first shared song on guitar.",
			},
			{
				who: "Zuzana",
				sk: "To je fantastické, Martin! Si trpezlivý a skvelý učiteľ.",
				en: "That is fantastic, Martin! You are a patient and wonderful teacher.",
			},
			{
				who: "Martin",
				sk: "Vybral som z batohu novú kartovú hru s otázkami o slovenskej histórii a prírode.",
				en: "I took a new card game with questions about Slovak history and nature out of my backpack.",
			},
			{
				who: "Matej",
				sk: "Výborne! Kto získa najviac bodov, toho pozývame na kávu budúci týždeň.",
				en: "Great! Whoever gets the most points, we treat to coffee next week.",
			},
			{
				who: "Zuzana",
				sk: "Hrali sme takmer dve hodiny, smiali sme sa a čas ubehol ako voda.",
				en: "We played for almost two hours, laughed and time passed like water.",
			},
			{
				who: "Martin",
				sk: "Nikto z nás sa ani raz nepozrel do mobilu, boli sme naplno spolu.",
				en: "None of us looked at a mobile phone even once, we were fully together.",
			},
			{
				who: "Matej",
				sk: "Takéto chvíle sú to najcennejšie, čo si v živote môžeme dopriať.",
				en: "Moments like these are the most valuable thing we can treat ourselves to in life.",
			},
			{
				who: "Zuzana",
				sk: "Pred odchodom sme sa objali a sľúbili si, že sa stretneme znova o týždeň.",
				en: "Before leaving we hugged and promised each other to meet again in a week.",
			},
			{
				who: "Matej",
				sk: "Kráčal som domov pod hviezdnou oblohou a v srdci som cítil hlbokú vďačnosť a pokoj.",
				en: "I walked home under the starry sky and felt deep gratitude and peace in my heart.",
			},
		],
		newWords: [
			{ sk: "klenbový", en: "vaulted, arched" },
			{ sk: "šľahačka", en: "whipped cream" },
			{ sk: "autor", en: "author" },
			{ sk: "vďačnosť", en: "gratitude" },
		],
		questions: [
			{
				kind: "recall",
				q: "V akom podniku sa priatelia stretli?",
				options: ["V bistre Starý dvor", "Vo veľkej reštaurácii pri stanici", "V kine"],
				answer: 0,
			},
			{
				kind: "detail",
				q: "Čo si objednala Zuzana?",
				options: ["Čaj s citrónom", "Hustú horúcu čokoládu so šľahačkou", "Kávu s mliekom"],
				answer: 1,
			},
			{
				kind: "gist",
				q: "Čo robili priatelia počas večera okrem rozprávania?",
				options: ["Hrali kartovú hru o slovenskej histórii a prírode", "Pozerali futbalový zápas", "Čítali si noviny"],
				answer: 0,
			},
		],
	},
];
