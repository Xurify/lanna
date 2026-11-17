import { useCallback, useEffect, useRef, useState } from "react";

export function useSessionTitle({ chatId, initialTitle }: { chatId: string; initialTitle: string }) {
	const [titleText, setTitleText] = useState(initialTitle);
	const [renaming, setRenaming] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const titleInputRef = useRef<HTMLInputElement | null>(null);

	const beginRename = useCallback(() => {
		setTitleDraft(titleText);
		setRenaming(true);
	}, [titleText]);

	const cancelRename = useCallback(() => setRenaming(false), []);

	const commitRename = useCallback(
		async (next: string) => {
			setRenaming(false);
			const trimmed = next.trim();
			if (trimmed === "" || trimmed === titleText) return;
			try {
				const response = await fetch(`/api/chats/${chatId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ title: trimmed }),
				});
				if (!response.ok) throw new Error(`rename failed: ${response.status}`);
				setTitleText(trimmed);
				window.dispatchEvent(new CustomEvent("lanna:chat-renamed", { detail: { id: chatId, title: trimmed } }));
			} catch (error) {
				console.error("rename failed:", error);
			}
		},
		[chatId, titleText],
	);

	useEffect(() => {
		if (!renaming) return;
		titleInputRef.current?.focus();
		titleInputRef.current?.select();
	}, [renaming]);

	useEffect(() => {
		window.addEventListener("lanna:kbd-rename-session", beginRename);
		return () => window.removeEventListener("lanna:kbd-rename-session", beginRename);
	}, [beginRename]);

	useEffect(() => {
		const onRenamed = (event: Event) => {
			const { id, title } = (event as CustomEvent<{ id: string; title: string }>).detail;
			if (id === chatId) setTitleText(title);
		};
		window.addEventListener("lanna:chat-renamed", onRenamed);
		return () => window.removeEventListener("lanna:chat-renamed", onRenamed);
	}, [chatId]);

	return {
		titleText,
		renaming,
		titleDraft,
		setTitleDraft,
		titleInputRef,
		beginRename,
		cancelRename,
		commitRename,
	};
}
