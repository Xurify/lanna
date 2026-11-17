import { useEffect, useRef, useState, type RefObject } from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";
import { useLatest } from "@/components/chat/use-latest";
import { COLLAPSE_DISTANCE_PX, EXPAND_DISTANCE_PX } from "@/components/chat/use-dock-geometry";

const REVEAL_INTENT_MS = 2000;

type ScrollToBottom = StickToBottomContext["scrollToBottom"];

interface DockFoldInput {
	scrollRef: RefObject<HTMLElement | null>;
	scrollToBottom: ScrollToBottom;
	isAtBottom: boolean;
	dockOwned: boolean;
	isMuted: () => boolean;
}

export function useDockFold({ scrollRef, scrollToBottom, isAtBottom, dockOwned, isMuted }: DockFoldInput) {
	const [expanded, setExpanded] = useState(true);
	const latest = useLatest({ expanded, dockOwned, isAtBottom, isMuted });
	const revealing = useRef(false);
	const revealTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const onScroll = () => {
			const current = latest.current;
			if (!current.dockOwned || current.isMuted()) return;
			const distance = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
			if (current.expanded) {
				if (distance > COLLAPSE_DISTANCE_PX && !revealing.current && !current.isAtBottom) setExpanded(false);
			} else if (distance < EXPAND_DISTANCE_PX) {
				setExpanded(true);
				void scrollToBottom();
			}
		};
		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => scroller.removeEventListener("scroll", onScroll);
	}, [scrollRef, scrollToBottom, latest]);

	const revealToBottom = () => {
		revealing.current = true;
		clearTimeout(revealTimer.current);
		revealTimer.current = setTimeout(() => {
			revealing.current = false;
		}, REVEAL_INTENT_MS);
		return Promise.resolve(scrollToBottom()).finally(() => {
			clearTimeout(revealTimer.current);
			revealing.current = false;
		});
	};

	const expand = () => {
		setExpanded(true);
		void revealToBottom();
	};

	return { expanded, expand };
}
