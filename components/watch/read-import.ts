import { useState } from "react";
import { useRouter } from "next/navigation";

export function useAddToRead() {
	const router = useRouter();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const add = (videoId: string) => {
		setBusyId(videoId);
		setError(null);
		fetch("/api/watch", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "import-read", videoId }),
		})
			.then(async (res) => {
				const body = (await res.json().catch(() => ({}))) as { storyId?: string; message?: string };
				if (!res.ok || !body.storyId) throw new Error(body.message ?? "Could not add it to Read.");
				router.push(`/read?id=${encodeURIComponent(body.storyId)}`);
			})
			.catch((err: Error) => {
				setError(err.message);
				setBusyId(null);
			});
	};
	return { busyId, error, add };
}
