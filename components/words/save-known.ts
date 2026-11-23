export async function saveKnown(slug: string, known: boolean): Promise<boolean> {
	try {
		const res = await fetch("/api/words/known", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug, known }),
		});
		return res.ok;
	} catch {
		return false;
	}
}
