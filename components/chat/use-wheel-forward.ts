import { useEffect, type RefObject } from "react";

// Wheel deltas reported in DOM_DELTA_LINE units are scaled by a 16px line, the browser's default line height.
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_PX = 16;

function canScrollToward(node: HTMLElement, deltaY: number): boolean {
	if (node.scrollHeight - node.clientHeight < 2) return false;
	return deltaY < 0 ? node.scrollTop > 0 : node.scrollTop < node.scrollHeight - node.clientHeight - 0.5;
}

function scaleWheelDelta(deltaY: number, deltaMode: number, pageHeight: number): number {
	if (deltaMode === DOM_DELTA_LINE) return deltaY * LINE_HEIGHT_PX;
	if (deltaMode === DOM_DELTA_PAGE) return deltaY * pageHeight;
	return deltaY;
}

export function useWheelForward(
	blockRef: RefObject<HTMLDivElement | null>,
	scrollRef: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const root = blockRef.current;
		const scroller = scrollRef.current;
		if (!root || !scroller) return;
		const onWheel = (event: WheelEvent) => {
			if (event.deltaY === 0) return;
			for (let node = event.target as HTMLElement | null; node && node !== root; node = node.parentElement) {
				if (node instanceof HTMLElement && canScrollToward(node, event.deltaY)) return;
			}
			event.preventDefault();
			scroller.scrollTop += scaleWheelDelta(event.deltaY, event.deltaMode, scroller.clientHeight);
		};
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	}, [blockRef, scrollRef]);
}
