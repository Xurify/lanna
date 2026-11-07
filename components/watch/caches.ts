/**
 * What the Watch shelf has already asked for, kept for the session, so closing
 * a panel and opening it again, or switching Best and Newest back and forth,
 * is not another round trip (and for a creator, not another trip to YouTube).
 * The server keeps its own short copy (src/server/discover.ts, fragments.ts);
 * this one saves the request itself. Same rule as the server's: a result
 * younger than the limit is shown, a failed request is not kept.
 */

import { TtlMemo, type CreatorVideo, type FragmentAnalysis } from "@/src/core";

/** A creator's videos by `<language>|<picks refreshed at>|<channel>|<search>`: a new "Check again" is a new key. */
export const creatorListings = new TtlMemo<CreatorVideo[]>({ ttlMs: 10 * 60_000, max: 40 });

/** A video's fragments analysis by video id. */
export const fragmentAnalyses = new TtlMemo<FragmentAnalysis>({ ttlMs: 2 * 60_000, max: 6 });

/** A video was prepared or removed: listings say "in your videos", analyses say "prepared". */
export function forgetWatchCaches(): void {
	creatorListings.forget();
	fragmentAnalyses.forget();
}
