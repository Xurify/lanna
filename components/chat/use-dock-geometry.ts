import { useEffect, useRef, useState, type RefObject } from "react";
import { useIsoLayoutEffect } from "@/components/chat/use-iso-layout-effect";

export const COLLAPSE_DISTANCE_PX = 96;
export const EXPAND_DISTANCE_PX = 16;

const WIDTH_JITTER_PX = 2;
const GROWTH_JITTER_PX = 0.5;
const MOVE_MUTE_MS = 400;
const DOCK_HEIGHT_GAP_PX = 32;
const DOCK_MIN_HEIGHT_PX = 160;

export function shouldStampGeometryMute(nextHeight: number, previousHeight: number, dockOwned: boolean): boolean {
	return dockOwned && nextHeight > previousHeight + 1;
}

interface DockGeometryInput {
	scrollRef: RefObject<HTMLElement | null>;
	blockRef: RefObject<HTMLDivElement | null>;
}

export function useDockGeometry({ scrollRef, blockRef }: DockGeometryInput) {
	const [sbInset, setSbInset] = useState(0);
	const [dockMaxH, setDockMaxH] = useState<number | null>(null);
	const geometryStampedAt = useRef(0);
	const growthStampedAt = useRef(0);

	useIsoLayoutEffect(() => {
		const block = blockRef.current;
		if (!block) return;
		let width = 0;
		const measure = () => {
			if (Math.abs(block.offsetWidth - width) <= WIDTH_JITTER_PX) return;
			width = block.offsetWidth;
			geometryStampedAt.current = Date.now();
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(block);
		return () => observer.disconnect();
	}, [blockRef]);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const measure = () => {
			// scrollbar-gutter: stable reserves the same gutter on both edges.
			setSbInset(Math.round((scroller.offsetWidth - scroller.clientWidth) / 2));
			setDockMaxH(Math.max(scroller.clientHeight - DOCK_HEIGHT_GAP_PX, DOCK_MIN_HEIGHT_PX));
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, [scrollRef]);

	useEffect(() => {
		const scroller = scrollRef.current;
		const content = scroller?.firstElementChild as HTMLElement | null | undefined;
		if (!scroller || !content) return;
		let previousHeight = content.getBoundingClientRect().height;
		const observer = new ResizeObserver(() => {
			const height = content.getBoundingClientRect().height;
			if (height > previousHeight + GROWTH_JITTER_PX) growthStampedAt.current = Date.now();
			previousHeight = Math.max(previousHeight, height);
		});
		observer.observe(content);
		return () => observer.disconnect();
	}, [scrollRef]);

	const stampGeometry = () => {
		geometryStampedAt.current = Date.now();
	};

	const isMuted = (): boolean => {
		const now = Date.now();
		return now - geometryStampedAt.current < MOVE_MUTE_MS || now - growthStampedAt.current < MOVE_MUTE_MS;
	};

	return { sbInset, dockMaxH, stampGeometry, isMuted };
}
