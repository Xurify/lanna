/**
 * One GET shared by everything that asks for it at the same time.
 *
 * On a page load the sidebar, the speech helper, the appearance provider and the
 * settings dialog each asked for /api/profile and /api/settings on their own; the
 * server read and answered the same thing twice. Calls within `windowMs` of the
 * first share its parsed result; a later call asks again, so nothing is kept stale.
 * The result is shared: read it, do not change it.
 */
const shared = new Map<string, { at: number; value: Promise<unknown> }>();

export function sharedJson<T>(url: string, windowMs = 1500): Promise<T> {
	const hit = shared.get(url);
	if (hit && Date.now() - hit.at < windowMs) return hit.value as Promise<T>;
	const value = fetch(url).then((r) => {
		if (!r.ok) throw new Error(`status ${r.status}`);
		return r.json() as Promise<T>;
	});
	shared.set(url, { at: Date.now(), value });
	// A failed request is not worth sharing: the next caller tries again.
	value.catch(() => shared.delete(url));
	return value;
}
