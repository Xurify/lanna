import { useRef, type RefObject } from "react";
import { shouldStampGeometryMute } from "@/components/chat/use-dock-geometry";

const DOCK_GRADIENT_PX = 96;

interface DockReserveInput {
	blockRef: RefObject<HTMLDivElement | null>;
	dockOwned: boolean;
	stampGeometry: () => void;
	onReserve: (height: number) => void;
}

export function useDockReserve({ blockRef, dockOwned, stampGeometry, onReserve }: DockReserveInput) {
	const reservedRef = useRef(0);

	const offer = (blockHeight: number) => {
		const next = blockHeight + DOCK_GRADIENT_PX;
		if (next <= reservedRef.current + 0.5 && dockOwned) return;
		if (shouldStampGeometryMute(next, reservedRef.current, dockOwned)) stampGeometry();
		reservedRef.current = next;
		onReserve(next);
	};

	const measureBlock = () => {
		const block = blockRef.current;
		if (block) offer(block.getBoundingClientRect().height);
	};

	return { measureBlock };
}
