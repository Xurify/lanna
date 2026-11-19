/**
 * WATCH PICKS PINS (2026-11-05): creators saved from a link,
 * a handle or a video; a channel's feed; the videos and channels on a
 * YouTube page; a Takeout export; whether a video is spoken in the
 * language; the ranking; and the refresh end to end against a scripted
 * YouTube (no network).
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-discover-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const core = await import("../src/core/discover.ts");
const discover = await import("../src/server/discover.ts");
const { discoverStore } = await import("../src/store/discover.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const CAPTIONS = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "captions-sk.json3"), "utf-8");
const SLOVAK_CHANNEL = "UCB5vCakfZgmrW7WT75FAFEg";
const GERMAN_CHANNEL = "UCu86nwBWoPCM4AlB-_pbNcg";

// ─── Pure rules ─────────────────────────────────────────────────────────────

test("parseChannelInput: channel ids and links, handles, custom pages, a video; nothing else", () => {
	assert.deepEqual(core.parseChannelInput(SLOVAK_CHANNEL), { kind: "channel", id: SLOVAK_CHANNEL });
	assert.deepEqual(core.parseChannelInput(`https://www.youtube.com/channel/${SLOVAK_CHANNEL}/videos`), {
		kind: "channel",
		id: SLOVAK_CHANNEL,
	});
	assert.deepEqual(core.parseChannelInput("@foodinnature"), {
		kind: "page",
		url: "https://www.youtube.com/@foodinnature",
		handle: "@foodinnature",
	});
	assert.deepEqual(core.parseChannelInput("youtube.com/@foodinnature/videos"), {
		kind: "page",
		url: "https://www.youtube.com/@foodinnature",
		handle: "@foodinnature",
	});
	assert.deepEqual(core.parseChannelInput("https://www.youtube.com/c/Varenie"), {
		kind: "page",
		url: "https://www.youtube.com/c/Varenie",
	});
	assert.deepEqual(core.parseChannelInput("https://youtu.be/dQw4w9WgXcQ"), { kind: "video", id: "dQw4w9WgXcQ" });
	for (const bad of ["", "https://vimeo.com/123", "dQw4w9WgXcQ", "https://www.youtube.com/", "hello world"])
		assert.equal(core.parseChannelInput(bad), null, bad);
});

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <yt:channelId>B5vCakfZgmrW7WT75FAFEg</yt:channelId>
 <title>Food in Nature Slovakia</title>
 <entry>
  <yt:videoId>HHJXg-NBrEo</yt:videoId>
  <yt:channelId>${SLOVAK_CHANNEL}</yt:channelId>
  <title>Guláš &amp; knedle</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=HHJXg-NBrEo"/>
  <author><name>Food in Nature Slovakia</name></author>
  <published>2026-10-31T09:30:06+00:00</published>
 </entry>
 <entry>
  <yt:videoId>shortAAAAAA</yt:videoId>
  <title>Krátke</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/shortAAAAAA"/>
 </entry>
</feed>`;

test("parseChannelFeed: the channel, its uploads with dates and entities decoded, shorts left out", () => {
	const feed = core.parseChannelFeed(FEED);
	assert.deepEqual(feed.channel, { id: SLOVAK_CHANNEL, name: "Food in Nature Slovakia" });
	assert.equal(feed.videos.length, 1);
	assert.deepEqual(feed.videos[0], {
		id: "HHJXg-NBrEo",
		title: "Guláš & knedle",
		channel: "Food in Nature Slovakia",
		channelId: SLOVAK_CHANNEL,
		at: "2026-10-31T09:30:06+00:00",
	});
});

const PAGE = {
	responseContext: { mainAppWebResponseContext: { loggedOut: false } },
	contents: {
		sections: [
			{
				videoRenderer: {
					videoId: "aaaaaaaaaaa",
					title: { runs: [{ text: "Varíme " }, { text: "doma" }] },
					ownerText: {
						runs: [{ text: "Kuchár", navigationEndpoint: { browseEndpoint: { browseId: SLOVAK_CHANNEL } } }],
					},
					lengthText: { simpleText: "12:05" },
				},
			},
			{
				lockupViewModel: {
					contentId: "bbbbbbbbbbb",
					contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
					contentImage: {
						thumbnailViewModel: {
							overlays: [
								{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: "1:02:03" } }] } },
							],
						},
					},
					metadata: {
						lockupMetadataViewModel: {
							title: { content: "Rozhovor" },
							metadata: {
								contentMetadataViewModel: {
									metadataRows: [
										{
											metadataParts: [
												{
													text: {
														content: "Podcast",
														commandRuns: [
															{ onTap: { innertubeCommand: { browseEndpoint: { browseId: GERMAN_CHANNEL } } } },
														],
													},
												},
											],
										},
									],
								},
							},
						},
					},
				},
			},
			{
				lockupViewModel: {
					contentId: "PLxxxxxxxxxxxxxxxx",
					contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST",
					metadata: { lockupMetadataViewModel: { title: { content: "A playlist" } } },
				},
			},
			{
				reelShelfRenderer: {
					items: [{ reelItemRenderer: { videoId: "ccccccccccc", headline: { simpleText: "Short" } } }],
				},
			},
			{ videoRenderer: { videoId: "aaaaaaaaaaa", title: { simpleText: "Duplicate" } } },
			{
				channelRenderer: {
					channelId: GERMAN_CHANNEL,
					title: { simpleText: "Leicht & lecker" },
					subscriberCountText: { simpleText: "@leichtlecker" },
				},
			},
		],
	},
};

test("extractVideos: old renderers and lockups, page order, once each, no shorts or playlists", () => {
	assert.deepEqual(core.extractVideos(PAGE), [
		{ id: "aaaaaaaaaaa", title: "Varíme doma", channel: "Kuchár", channelId: SLOVAK_CHANNEL, durationSec: 725 },
		{ id: "bbbbbbbbbbb", title: "Rozhovor", channel: "Podcast", channelId: GERMAN_CHANNEL, durationSec: 3723 },
	]);
	assert.deepEqual(core.extractChannels(PAGE), [
		{ id: GERMAN_CHANNEL, name: "Leicht & lecker", handle: "@leichtlecker" },
	]);
});

test("Takeout: history as JSON and as HTML (ads left out), subscriptions by shape, the kind told by content", () => {
	const json = JSON.stringify([
		{
			header: "YouTube",
			title: "Watched Varíme doma",
			titleUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
			subtitles: [{ name: "Kuchár", url: `https://www.youtube.com/channel/${SLOVAK_CHANNEL}` }],
			time: "2026-11-01T10:00:00Z",
		},
		{
			header: "YouTube",
			title: "Watched An ad",
			titleUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
			details: [{ name: "From Google Ads" }],
		},
		{ header: "YouTube", title: "Watched a video that has been removed" },
	]);
	assert.deepEqual(core.parseTakeoutHistory(json), [
		{
			id: "aaaaaaaaaaa",
			title: "Varíme doma",
			channel: "Kuchár",
			channelId: SLOVAK_CHANNEL,
			at: "2026-11-01T10:00:00Z",
		},
	]);
	const html = `<html><body><div class="outer-cell mdl-cell"><div class="content-cell">Watched&nbsp;<a href="https://www.youtube.com/watch?v=aaaaaaaaaaa">Varíme &amp; jeme</a><br><a href="https://www.youtube.com/channel/${SLOVAK_CHANNEL}">Kuchár</a><br>Nov 1, 2026</div></div><div class="outer-cell"><a href="https://www.youtube.com/watch?v=bbbbbbbbbbb">Ad</a> From Google Ads</div></body></html>`;
	assert.deepEqual(core.parseTakeoutHistory(html), [
		{ id: "aaaaaaaaaaa", title: "Varíme & jeme", channelId: SLOVAK_CHANNEL, channel: "Kuchár" },
	]);
	const csv = `Channel Id,Channel Url,Channel Title\n${SLOVAK_CHANNEL},http://www.youtube.com/channel/${SLOVAK_CHANNEL},"Food, in Nature"\n`;
	assert.deepEqual(core.parseTakeoutSubscriptions(csv), [{ id: SLOVAK_CHANNEL, name: "Food, in Nature" }]);
	assert.equal(core.takeoutKind(json), "history");
	assert.equal(core.takeoutKind(html), "history");
	assert.equal(core.takeoutKind(csv), "subscriptions");
	assert.equal(core.takeoutKind("hello"), null);
});

test("judgeSpoken: the automatic track decides; else the title, unless a translated set; too little to go on is unsure", () => {
	const sk = { lang: "sk", fallbacks: ["cs"] };
	assert.equal(core.judgeSpoken({ ...sk, tracks: ["sk:asr"] }), "yes");
	assert.equal(core.judgeSpoken({ ...sk, tracks: ["cs:asr", "en"] }), "yes", "a fallback's automatic track");
	assert.equal(
		core.judgeSpoken({ ...sk, tracks: ["pl:asr", "sk"], titleShare: 0.7, titleWords: 8 }),
		"yes",
		"a Slovak title over a mislabelled automatic track",
	);
	assert.equal(
		core.judgeSpoken({ ...sk, tracks: ["de", "sk", "en", "fr", "pl", "hu"], titleShare: 0.8, titleWords: 8 }),
		"unsure",
		"a translated set says nothing of the speech",
	);
	assert.equal(core.judgeSpoken({ ...sk, tracks: ["sk"], titleShare: 0.05, titleWords: 9 }), "no");
	assert.equal(core.judgeSpoken({ ...sk, tracks: ["sk"], titleShare: 0.9, titleWords: 2 }), "unsure");
});

test("judgeSpoken: YouTube's machine-translated automatic tracks are not speech", () => {
	const ru = { lang: "ru" };
	const translated = ["ar:asr", "en:asr", "fr:asr", "de:asr", "ru:asr", "es:asr", "uk:asr"];
	assert.equal(
		core.judgeSpoken({ ...ru, tracks: translated, titleShare: 0, titleWords: 8 }),
		"no",
		"an English video with a Russian automatic track",
	);
	assert.equal(core.judgeSpoken({ ...ru, tracks: translated }), "unsure", "no title to go on");
	assert.equal(
		core.judgeSpoken({ ...ru, tracks: translated, titleShare: 0.8, titleWords: 8 }),
		"yes",
		"a Russian title over the same set",
	);
	assert.equal(
		core.judgeSpoken({ ...ru, tracks: ["en:asr", "ru:asr"] }),
		"yes",
		"two automatic tracks are still speech",
	);
});

test("rejudgeSpoken: an old 'yes' on a translated set is judged by its title; a real one stays", () => {
	const set = ["ar:asr", "en:asr", "fr:asr", "de:asr", "ru:asr"];
	const old = scanned({ tracks: set, trackLang: "ru", spoken: "yes", titleShare: 0 });
	assert.equal(core.rejudgeSpoken(old).spoken, "no");
	assert.equal(
		core.rejudgeSpoken(scanned({ tracks: set, trackLang: "ru", spoken: "yes", titleShare: 0.7 })).spoken,
		"yes",
	);
	const real = scanned({ tracks: ["ru:asr"], trackLang: "ru", spoken: "yes", titleShare: 0 });
	assert.equal(core.rejudgeSpoken(real), real, "one automatic track is left as it was");
	assert.deepEqual(core.suggestCreators([core.rejudgeSpoken({ ...old, channelId: SLOVAK_CHANNEL })], new Set()), []);
});

function scanned(
	over: Partial<import("../src/core/discover.ts").ScannedVideo>,
): import("../src/core/discover.ts").ScannedVideo {
	return {
		id: "aaaaaaaaaaa",
		title: "t",
		durationSec: 600,
		scannedAt: "2026-11-05T00:00:00Z",
		tracks: ["sk:asr"],
		spoken: "yes",
		trackLang: "sk",
		captionKind: "captions",
		coverage: 0.95,
		wordsPerMin: 140,
		sources: ["creator"],
		...over,
	};
}

test("rankPicks: comfortable before a stretch before hard; sparse speech, unsure speech and automatic captions count less; library and dismissed left out", () => {
	const now = new Date("2026-11-05T12:00:00Z");
	const list = [
		scanned({ id: "hard0000000", coverage: 0.82 }),
		scanned({ id: "comfortable", coverage: 0.95 }),
		scanned({ id: "stretch0000", coverage: 0.9 }),
		scanned({ id: "musicvideo0", coverage: 0.96, wordsPerMin: 12 }),
		scanned({ id: "unsure00000", coverage: 0.95, spoken: "unsure" }),
		scanned({ id: "autocaption", coverage: 0.95, captionKind: "auto-captions" }),
		scanned({ id: "notspoken00", spoken: "no" }),
		scanned({ id: "nocaptions0", skip: "no-captions" }),
		scanned({ id: "inlibrary00" }),
	];
	const ids = core.rankPicks(list, { exclude: new Set(["inlibrary00"]), now }).map((p) => p.id);
	assert.deepEqual(ids, ["comfortable", "autocaption", "stretch0000", "unsure00000", "hard0000000", "musicvideo0"]);
	assert.equal(core.rankPicks([scanned({ coverage: 0.95 })], { now })[0]!.band, "comfortable");
});

test("channelImage: Google's image hosts only, the biggest picture, cropped small; nothing else", () => {
	const big = {
		thumbnails: [
			{ url: "https://yt3.ggpht.com/a=s48-c-k-c0x00ffffff-no-rj", width: 48 },
			{ url: "//yt3.ggpht.com/b=s176-c-k-c0x00ffffff-no-rj", width: 176 },
		],
	};
	assert.equal(core.channelImage(big), "https://yt3.ggpht.com/b=s96-c-k-c0x00ffffff-no-rj");
	assert.equal(core.channelImage(big.thumbnails), "https://yt3.ggpht.com/b=s96-c-k-c0x00ffffff-no-rj");
	assert.equal(core.channelImage({ thumbnails: [{ url: "https://evil.example/a.png" }] }), undefined);
	assert.equal(core.channelImage({ thumbnails: [{ url: "http://yt3.ggpht.com/a" }] }), undefined);
	assert.equal(core.channelImage({ thumbnails: [{ url: "https://yt3.ggpht.com.evil.example/a" }] }), undefined);
	assert.equal(core.channelImage(undefined), undefined);
	const [ch] = core.extractChannels({
		items: [{ channelRenderer: { channelId: SLOVAK_CHANNEL, title: { simpleText: "Sub" }, thumbnail: big } }],
	});
	assert.equal(ch?.avatar, "https://yt3.ggpht.com/b=s96-c-k-c0x00ffffff-no-rj");
});

test("suggestCreators: channels spoken in the language, subscribed first, saved and sparse ones left out", () => {
	const list = [
		scanned({ id: "a1111111111", channelId: SLOVAK_CHANNEL, channel: "Kuchár", sources: ["history"] }),
		scanned({ id: "a2222222222", channelId: SLOVAK_CHANNEL, channel: "Kuchár", sources: ["recommended"] }),
		scanned({ id: "b1111111111", channelId: GERMAN_CHANNEL, channel: "Leicht", sources: ["search"], spoken: "no" }),
		scanned({
			id: "c1111111111",
			channelId: "UCcccccccccccccccccccccc",
			channel: "Music",
			sources: ["history"],
			wordsPerMin: 10,
		}),
		scanned({ id: "d1111111111", channelId: "UCdddddddddddddddddddddd", channel: "Sub", sources: ["subscriptions"] }),
		scanned({ id: "e1111111111", channelId: "UCeeeeeeeeeeeeeeeeeeeeee", channel: "Saved", sources: ["history"] }),
	];
	const got = core.suggestCreators(list, new Set(["UCeeeeeeeeeeeeeeeeeeeeee"]), [
		{ id: "UCdddddddddddddddddddddd", name: "Sub" },
	]);
	assert.deepEqual(
		got.map((s) => [s.name, s.videos, s.from.join("+"), s.subscribed]),
		[
			["Sub", 1, "subscriptions", true],
			["Kuchár", 2, "history+recommended", false],
		],
	);
});

// ─── The service, against a scripted YouTube ────────────────────────────────

/** A player answer for a video. */
function player(
	id: string,
	o: {
		title: string;
		channelId: string;
		channel: string;
		tracks: Array<{ lang: string; asr?: boolean }>;
		sec?: number;
		description?: string;
	},
) {
	return {
		playabilityStatus: { status: "OK" },
		videoDetails: {
			videoId: id,
			title: o.title,
			author: o.channel,
			channelId: o.channelId,
			lengthSeconds: String(o.sec ?? 300),
			shortDescription: o.description ?? "",
		},
		captions: {
			playerCaptionsTracklistRenderer: {
				captionTracks: o.tracks.map((t) => ({
					baseUrl: `https://www.youtube.com/api/timedtext?v=${id}&lang=${t.lang}`,
					languageCode: t.lang,
					...(t.asr ? { kind: "asr" } : {}),
				})),
			},
		},
	};
}

const PLAYERS: Record<string, ReturnType<typeof player>> = {
	"HHJXg-NBrEo": player("HHJXg-NBrEo", {
		title: "Ahojte, dnes vám ukážem Bratislavu",
		channelId: SLOVAK_CHANNEL,
		channel: "Food in Nature Slovakia",
		tracks: [{ lang: "sk", asr: true }],
	}),
	ZY7eJbQZmL4: player("ZY7eJbQZmL4", {
		title: "Kartoffeln mit Hackfleisch sind besser als Pizza",
		channelId: GERMAN_CHANNEL,
		channel: "Leicht & lecker",
		tracks: [{ lang: "de", asr: true }, { lang: "sk" }, { lang: "en" }],
	}),
	aaaaaaaaaaa: player("aaaaaaaaaaa", {
		title: "Varíme doma",
		channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
		channel: "Kuchár",
		tracks: [{ lang: "en", asr: true }],
	}),
};

const calls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	calls.push(url);
	const json = (v: unknown) =>
		new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
	if (url.includes("/youtubei/v1/navigation/resolve_url")) {
		const body = JSON.parse(String(init?.body)) as { url: string };
		return body.url.endsWith("@foodinnature")
			? json({ endpoint: { browseEndpoint: { browseId: SLOVAK_CHANNEL } } })
			: new Response("{}", { status: 404 });
	}
	if (url.includes("/feeds/videos.xml"))
		return url.includes(SLOVAK_CHANNEL) ? new Response(FEED, { status: 200 }) : new Response("", { status: 404 });
	if (url.includes("/youtubei/v1/browse")) {
		const { browseId } = JSON.parse(String(init?.body)) as { browseId: string };
		const avatar =
			browseId === "UCnopicture0000000000000"
				? undefined
				: {
						thumbnails: [
							{
								url: `https://yt3.googleusercontent.com/${browseId}=s900-c-k-c0x00ffffff-no-rj`,
								width: 900,
								height: 900,
							},
						],
					};
		return json({
			metadata: { channelMetadataRenderer: { title: "Leicht & lecker", ...(avatar ? { avatar } : {}) } },
			contents: {},
		});
	}
	if (url.includes("/youtubei/v1/player")) {
		const id = (JSON.parse(String(init?.body)) as { videoId: string }).videoId;
		return PLAYERS[id]
			? json(PLAYERS[id])
			: json({ playabilityStatus: { status: "ERROR", reason: "Video unavailable" } });
	}
	if (url.includes("/watch?v=")) return new Response("<html></html>", { status: 200 });
	if (url.includes("/api/timedtext")) return new Response(CAPTIONS, { status: 200 });
	if (url.includes("/youtubei/v1/search")) return json(PAGE);
	return new Response("not scripted", { status: 500 });
}) as typeof fetch;
after(() => {
	globalThis.fetch = realFetch;
});

describe("the service", () => {
	test("a creator is saved from an @handle, a channel link or one of their videos, once", async () => {
		const c = await discover.addCreator("@foodinnature", "link", { now: new Date("2026-11-05T10:00:00Z") });
		assert.deepEqual(c, {
			id: SLOVAK_CHANNEL,
			name: "Food in Nature Slovakia",
			handle: "@foodinnature",
			addedAt: "2026-11-05T10:00:00.000Z",
			from: "link",
		});
		const again = await discover.addCreator(`https://www.youtube.com/channel/${SLOVAK_CHANNEL}`);
		assert.equal(again.addedAt, c.addedAt, "the same creator is not saved twice");
		const fromVideo = await discover.addCreator("https://www.youtube.com/watch?v=ZY7eJbQZmL4");
		assert.equal(fromVideo.id, GERMAN_CHANNEL);
		assert.equal(fromVideo.name, "Leicht & lecker", "the name from the browse fallback when the feed fails");
		await assert.rejects(discover.addCreator("@nobody-here"), /no channel/);
		await assert.rejects(discover.addCreator("not a channel"), /not a YouTube channel/);
		assert.equal(discover.listCreators().length, 2);
		assert.equal(discover.removeCreator(GERMAN_CHANNEL), true);
		assert.equal(discover.removeCreator(GERMAN_CHANNEL), false);
	});

	test("a saved creator keeps the channel's picture, also when only the browse page has it; creators saved before are filled in once", async () => {
		const pics = discoverStore.avatars();
		assert.equal(
			pics[SLOVAK_CHANNEL],
			`https://yt3.googleusercontent.com/${SLOVAK_CHANNEL}=s96-c-k-c0x00ffffff-no-rj`,
			"the feed has no picture, so the channel page is asked",
		);
		assert.equal(discover.discoverState().creators.find((c) => c.id === SLOVAK_CHANNEL)?.avatar, pics[SLOVAK_CHANNEL]);

		discoverStore.putAvatars({});
		const before = calls.length;
		await discover.fillAvatars();
		assert.equal(discoverStore.avatars()[SLOVAK_CHANNEL], pics[SLOVAK_CHANNEL]);
		const asked = calls.length - before;
		await discover.fillAvatars();
		assert.equal(calls.length - before, asked, "a channel is not asked again on every visit");
	});

	test("a page read while signed in becomes the list; a signed-out page is refused", () => {
		const html = `<script>var ytInitialData = ${JSON.stringify(PAGE)};</script>`;
		assert.equal(discover.importYouTube("history", { html }, "account", new Date("2026-11-05T11:00:00Z")), 2);
		assert.equal(discover.importYouTube("subscriptions", { html }, "account"), 1);
		const out = `<script>var ytInitialData = ${JSON.stringify({ ...PAGE, responseContext: { mainAppWebResponseContext: { loggedOut: true } } })};</script>`;
		assert.throws(() => discover.importYouTube("recommended", { html: out }, "account"), /signed in/);
		assert.equal(
			discover.importYouTube(
				"recommended",
				{
					videos: [
						{ id: "ZY7eJbQZmL4", title: "x" },
						{ id: "bad id", title: "y" },
					],
				},
				"account",
			),
			1,
			"items are checked",
		);
		const yt = discoverStore.youtube();
		assert.equal(yt.history?.videos[0]?.title, "Varíme doma");
		assert.equal(yt.history?.at, "2026-11-05T11:00:00.000Z");
		const saved = fs.readFileSync(
			path.join(TMP_DATA, "profiles", "slovak", "media", "discover", "youtube.json"),
			"utf-8",
		);
		assert.doesNotMatch(saved, /cookie|SAPISID|password/i);
	});

	test("who is signed in: from the account switcher (name, handle, picture; never the email), or the page's top bar picture", () => {
		const switcher = `)]}'\n${JSON.stringify({
			actions: [
				{
					getMultiPageMenuAction: {
						menu: {
							multiPageMenuRenderer: {
								header: {
									googleAccountHeaderRenderer: {
										name: { simpleText: "Kristýna" },
										email: { simpleText: "kristyna@example.com" },
									},
								},
								sections: [
									{
										accountSectionListRenderer: {
											contents: [
												{
													accountItemSectionRenderer: {
														contents: [
															{
																accountItem: {
																	accountName: { simpleText: "Other" },
																	isSelected: false,
																	accountPhoto: {
																		thumbnails: [
																			{ url: "https://yt3.ggpht.com/other=s88-c-k-c0x00ffffff-no-rj", width: 88 },
																		],
																	},
																},
															},
															{
																accountItem: {
																	accountName: { runs: [{ text: "Kristýna " }, { text: "N." }] },
																	isSelected: true,
																	channelHandle: { simpleText: "@kristyna" },
																	accountPhoto: {
																		thumbnails: [
																			{ url: "https://lh3.googleusercontent.com/a/ABC=s32-c", width: 32 },
																			{ url: "https://lh3.googleusercontent.com/a/ABC=s88-c", width: 88 },
																		],
																	},
																},
															},
														],
													},
												},
											],
										},
									},
								],
							},
						},
					},
				},
			],
		})}`;
		assert.deepEqual(core.accountFromSwitcher(switcher), {
			name: "Kristýna N.",
			handle: "@kristyna",
			photo: "https://lh3.googleusercontent.com/a/ABC=s96-c",
		});
		assert.equal(core.accountFromSwitcher(")]}'\n{}"), null);
		assert.equal(core.accountFromSwitcher("not json"), null);
		assert.deepEqual(
			core.accountFromSwitcher(
				JSON.stringify({
					accountItem: {
						accountName: { simpleText: "X" },
						accountPhoto: { thumbnails: [{ url: "https://evil.example/pic", width: 88 }] },
						channelHandle: { simpleText: "not a handle" },
					},
				}),
			),
			{ name: "X" },
			"a picture off Google's hosts and a malformed handle are dropped",
		);

		const kept = discover.importYouTubeAccount(switcher, new Date("2026-11-07T12:00:00Z"));
		assert.deepEqual(kept, {
			at: "2026-11-07T12:00:00.000Z",
			name: "Kristýna N.",
			handle: "@kristyna",
			photo: "https://lh3.googleusercontent.com/a/ABC=s96-c",
		});
		assert.deepEqual(discover.discoverState().youtubeAccount, kept);
		const saved = fs.readFileSync(
			path.join(TMP_DATA, "profiles", "slovak", "media", "discover", "youtube.json"),
			"utf-8",
		);
		assert.doesNotMatch(saved, /example\.com|email/i, "the email is never kept");
		assert.throws(() => discover.importYouTubeAccount(")]}'\n{}"), /who is signed in/);

		// A page's top bar gives the picture when the switcher could not be read.
		discover.forgetYouTubeAccount();
		assert.equal(discover.discoverState().youtubeAccount, undefined);
		const page = {
			...PAGE,
			topbar: {
				desktopTopbarRenderer: {
					topbarButtons: [
						{
							topbarMenuButtonRenderer: {
								avatar: { thumbnails: [{ url: "https://yt3.ggpht.com/me=s88-c-k-c0x00ffffff-no-rj", width: 88 }] },
							},
						},
					],
				},
			},
		};
		discover.importYouTube(
			"history",
			{ html: `<script>var ytInitialData = ${JSON.stringify(page)};</script>` },
			"account",
			new Date("2026-11-07T12:05:00Z"),
		);
		assert.deepEqual(discover.discoverState().youtubeAccount, {
			at: "2026-11-07T12:05:00.000Z",
			photo: "https://yt3.ggpht.com/me=s96-c-k-c0x00ffffff-no-rj",
		});
		discover.forgetYouTubeAccount();
	});

	test("the refresh reads the feeds and lists, checks each video once, and offers only the Slovak one", async () => {
		const engine = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		engine.setResponses([
			fauxAssistantMessage(JSON.stringify({ queries: ["varenie doma", "varenie doma", '"vlog"'] })),
		]);
		await discover.refreshDiscover({
			now: new Date("2026-11-05T12:00:00Z"),
			engine: { model: engine.getModel(), streamFn: engine.streamSimple },
			model: "faux:faux",
			keepReady: false,
		});
		const scans = discoverStore.scans();
		assert.equal(scans["HHJXg-NBrEo"]?.spoken, "yes");
		assert.equal(scans["HHJXg-NBrEo"]?.trackLang, "sk");
		assert.ok((scans["HHJXg-NBrEo"]?.coverage ?? -1) >= 0, "the known-word share is measured");
		assert.ok((scans["HHJXg-NBrEo"]?.wordsPerMin ?? 0) > 0);
		assert.equal(scans["HHJXg-NBrEo"]?.publishedAt, "2026-10-31T09:30:06+00:00");
		assert.equal(scans["ZY7eJbQZmL4"]?.skip, "other-language", "German speech with uploaded Slovak subtitles");
		assert.equal(scans["aaaaaaaaaaa"]?.skip, "no-captions");
		assert.equal(scans["bbbbbbbbbbb"]?.skip, "unavailable");
		assert.deepEqual(discoverStore.searches()?.queries, ["varenie doma", "vlog"], "deduped and cleaned");
		assert.ok(
			fs.existsSync(path.join(TMP_DATA, "profiles", "slovak", "media", "discover", "text", "HHJXg-NBrEo.sk.txt")),
			"the lines are kept to measure again",
		);

		const state = discover.discoverState(new Date("2026-11-05T12:00:00Z"));
		assert.deepEqual(
			state.picks.map((p) => p.id),
			["HHJXg-NBrEo"],
		);
		assert.equal(state.creators[0]?.picks, 1);
		assert.equal(state.refreshedAt, "2026-11-05T12:00:00.000Z");
		assert.equal(state.refresh.running, false);

		const before = calls.filter((c) => c.includes("/youtubei/v1/player")).length;
		await discover.refreshDiscover({ now: new Date("2026-11-05T13:00:00Z"), keepReady: false });
		assert.equal(
			calls.filter((c) => c.includes("/youtubei/v1/player")).length,
			before + 1,
			"a video checked once is not fetched again, except the new one that had no captions yet",
		);

		// A new upload's automatic captions arrive later: it is checked again, and only while it is new.
		const noCaptions = { ...discoverStore.scans()["aaaaaaaaaaa"]!, publishedAt: "2026-11-05T01:00:00Z" };
		discoverStore.putScans({ ...discoverStore.scans(), aaaaaaaaaaa: noCaptions });
		const original = PLAYERS["aaaaaaaaaaa"]!;
		PLAYERS["aaaaaaaaaaa"] = player("aaaaaaaaaaa", {
			title: "Varíme doma",
			channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
			channel: "Kuchár",
			tracks: [{ lang: "sk", asr: true }],
		});
		try {
			await discover.refreshDiscover({ now: new Date("2026-11-05T14:00:00Z"), keepReady: false });
			assert.equal(discoverStore.scans()["aaaaaaaaaaa"]?.skip, undefined, "the captions that arrived were found");
			assert.equal(discoverStore.scans()["aaaaaaaaaaa"]?.trackLang, "sk");
		} finally {
			PLAYERS["aaaaaaaaaaa"] = original;
			discoverStore.putScans({ ...discoverStore.scans(), aaaaaaaaaaa: noCaptions });
		}
	});

	test("a dismissed pick is gone; forgetting YouTube drops what only it found; keep one ready needs a model", () => {
		discover.dismissPick("HHJXg-NBrEo");
		assert.equal(discover.picks().length, 0);
		assert.equal(discover.keepOneReady(), null, "no model is configured in the test profile");
		discover.forgetYouTube();
		assert.deepEqual(discoverStore.youtube(), {});
		const scans = discoverStore.scans();
		assert.ok(scans["HHJXg-NBrEo"], "a creator's video stays");
		assert.equal(scans["ZY7eJbQZmL4"], undefined, "a video only the recommendations found is dropped");
	});

	test("several channels are saved from pasted text, naming the one that fails", async () => {
		assert.deepEqual(
			core.splitChannelInputs("@foodinnature, @nobody-here\n@foodinnature  https://youtu.be/dQw4w9WgXcQ"),
			["@foodinnature", "@nobody-here", "https://youtu.be/dQw4w9WgXcQ"],
		);
		const r = await discover.addCreators(["@foodinnature", "@nobody-here"]);
		assert.equal(r.saved.length, 1);
		assert.equal(r.saved[0]?.id, SLOVAK_CHANNEL);
		assert.equal(r.failed.length, 1);
		assert.equal(r.failed[0]?.input, "@nobody-here");
		assert.match(r.failed[0]?.message ?? "", /no channel/);
	});

	test("suggested channels are turned down, or saved in one go with no request; a creator's row lists its picks", () => {
		const CH = { b: "UCbbbbbbbbbbbbbbbbbbbbbb", c: "UCcccccccccccccccccccccc", d: "UCdddddddddddddddddddddd" };
		const scan = (id: string, channelId: string, channel: string) => ({
			id,
			title: `Video ${id}`,
			channelId,
			channel,
			durationSec: 600,
			scannedAt: "2026-11-06T10:00:00.000Z",
			tracks: ["sk:asr"],
			spoken: "yes" as const,
			trackLang: "sk",
			captionKind: "auto-captions" as const,
			coverage: 0.9,
			wordsPerMin: 120,
			sources: ["search" as const],
		});
		discoverStore.putScans({
			...discoverStore.scans(),
			bbbbbbbbbb1: scan("bbbbbbbbbb1", CH.b, "B"),
			cccccccccc1: scan("cccccccccc1", CH.c, "C"),
			dddddddddd1: scan("dddddddddd1", CH.d, "D"),
		});
		assert.deepEqual(
			discover
				.discoverState()
				.suggestions.map((s) => s.id)
				.sort(),
			[CH.b, CH.c, CH.d],
		);
		const before = calls.length;

		discover.dismissSuggestion(CH.c);
		assert.deepEqual(
			discover
				.discoverState()
				.suggestions.map((s) => s.id)
				.sort(),
			[CH.b, CH.d],
		);

		assert.deepEqual(
			discover.saveSuggestions([CH.b]).map((c) => [c.id, c.name, c.from]),
			[[CH.b, "B", "search"]],
		);
		assert.equal(
			discover.discoverState().creators.find((c) => c.id === CH.b)?.videos[0]?.id,
			"bbbbbbbbbb1",
			"its picks are listed on its row",
		);
		assert.equal(discover.saveSuggestions().length, 1, "all the rest, but not the one turned down");
		assert.deepEqual(discover.saveSuggestions(), [], "nothing is saved twice");
		const state = discover.discoverState();
		assert.ok(state.creators.some((c) => c.id === CH.d));
		assert.ok(!state.creators.some((c) => c.id === CH.c));
		assert.equal(calls.length, before, "saving what the page shows asks YouTube for nothing");
	});

	test("a video found too long once is checked again now that it fits", async () => {
		const kept = discoverStore.scans()["HHJXg-NBrEo"]!;
		assert.ok((await import("../src/core/watch.ts")).MAX_VIDEO_SEC >= 90 * 60);
		discoverStore.putScans({
			...discoverStore.scans(),
			"HHJXg-NBrEo": { ...kept, skip: "too-long", durationSec: 4602 },
		});
		await discover.refreshDiscover({ now: new Date("2026-11-06T12:00:00Z"), keepReady: false });
		const again = discoverStore.scans()["HHJXg-NBrEo"]!;
		assert.equal(again.skip, undefined);
		assert.ok(again.sources.includes("creator"));
	});
});

test("awaitingCaptions: a fresh upload without captions is looked at again; an old one, or one with captions, is not", () => {
	const now = new Date("2026-11-06T12:00:00Z");
	const at = "2026-11-06T01:00:00Z";
	assert.equal(core.awaitingCaptions({ skip: "no-captions", publishedAt: at, scannedAt: at }, now), true);
	assert.equal(
		core.awaitingCaptions({ skip: "no-captions", publishedAt: "2026-11-01T01:00:00Z", scannedAt: at }, now),
		false,
		"old upload",
	);
	assert.equal(
		core.awaitingCaptions({ skip: "no-captions", scannedAt: at }, now),
		true,
		"no publishing date: counted from the first check",
	);
	assert.equal(core.awaitingCaptions({ skip: "no-captions", scannedAt: "2026-11-01T01:00:00Z" }, now), false);
	assert.equal(core.awaitingCaptions({ publishedAt: at, scannedAt: at }, now), false);
	assert.equal(core.awaitingCaptions({ skip: "too-long", publishedAt: at, scannedAt: at }, now), false);
});

describe("one creator's videos (search, newest, sort)", () => {
	const now = new Date("2026-11-06T12:00:00Z");
	const base = {
		title: "t",
		durationSec: 600,
		scannedAt: now.toISOString(),
		tracks: ["sk"],
		spoken: "yes" as const,
		trackLang: "sk",
		captionKind: "captions" as const,
		sources: ["creator" as const],
	};

	test("agoToIso reads YouTube's English relative dates, nothing else", () => {
		assert.equal(core.agoToIso("3 weeks ago", now), "2026-10-16T12:00:00.000Z");
		assert.equal(core.agoToIso("Streamed 2 days ago", now), "2026-11-04T12:00:00.000Z");
		assert.equal(core.agoToIso("pred 3 týždňami", now), undefined);
	});

	test("publishedTimes finds the date on an old renderer and on a lockup", () => {
		const page = {
			a: { videoRenderer: { videoId: "aaaaaaaaaaa", publishedTimeText: { simpleText: "4 months ago" } } },
			b: {
				lockupViewModel: {
					contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
					contentId: "bbbbbbbbbbb",
					metadata: { rows: [{ parts: [{ text: { content: "17K views" } }, { text: { content: "2 days ago" } }] }] },
				},
			},
		};
		const times = core.publishedTimes(page);
		assert.equal(times.get("aaaaaaaaaaa"), "4 months ago");
		assert.equal(times.get("bbbbbbbbbbb"), "2 days ago");
	});

	test("every video says why it is or is not offered; only offered ones score", () => {
		const rows = core.creatorVideoRows(
			[
				{ ...base, id: "offered0000", coverage: 0.95, publishedAt: "2026-10-01T00:00:00Z" },
				{ ...base, id: "library0000" },
				{ ...base, id: "dismissed00" },
				{ ...base, id: "nocaptions0", skip: "no-captions" as const },
				{ ...base, id: "otherlang00", spoken: "no" as const },
			],
			{ library: new Set(["library0000"]), dismissed: new Set(["dismissed00"]), now },
		);
		assert.deepEqual(
			rows.map((r) => r.status),
			["offered", "in-library", "dismissed", "no-captions", "not-in-language"],
		);
		assert.ok(rows[0]!.score > 0);
		assert.ok(rows.slice(1).every((r) => r.score === 0));
	});

	test("best puts offered videos first; newest goes by date, undated last", () => {
		const rows = core.creatorVideoRows(
			[
				{ ...base, id: "oldgood0000", coverage: 0.95, publishedAt: "2026-01-01T00:00:00Z" },
				{ ...base, id: "newskipped0", skip: "too-long" as const, publishedAt: "2026-11-05T00:00:00Z" },
				{ ...base, id: "undated0000", coverage: 0.9 },
				{ ...base, id: "midgood0000", coverage: 0.7, publishedAt: "2026-06-01T00:00:00Z" },
			],
			{ library: new Set(), dismissed: new Set(), now },
		);
		assert.deepEqual(
			core.sortCreatorVideos(rows, "newest").map((r) => r.id),
			["newskipped0", "midgood0000", "oldgood0000", "undated0000"],
		);
		const best = core.sortCreatorVideos(rows, "best").map((r) => r.id);
		assert.equal(best.at(-1), "newskipped0");
		assert.equal(best[0], "oldgood0000");
	});

	test("creatorVideos refuses a channel that is not saved", async () => {
		await assert.rejects(discover.creatorVideos("UCzzzzzzzzzzzzzzzzzzzzzz"), /not saved/);
	});
});
