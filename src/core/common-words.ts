/** Share of the commonest words that must be marked for a prefix to count as "already marked":
 *  a learner who marked the top 1,000 and then un-marked a dozen still has 1,000 marked. */
const MARKED_PREFIX_SHARE = 0.9;

/** How far down the frequency list the learner's marks reach: the longest prefix ending on a
 *  marked word with at least 90% of it marked, raised to the next stop so the slider opens on
 *  the edge of what is marked. 0 when nothing near the top is marked. */
export function markedReach(known: readonly boolean[], stops: readonly number[]): number {
	let marked = 0;
	let reach = 0;
	for (let i = 0; i < known.length; i++) {
		if (!known[i]) continue;
		marked++;
		if (marked >= MARKED_PREFIX_SHARE * (i + 1)) reach = i + 1;
	}
	if (reach === 0) return 0;
	const sorted = [...stops].sort((a, b) => a - b);
	return sorted.find((stop) => stop >= reach) ?? reach;
}
