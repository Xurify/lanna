import { useRef, type RefObject } from "react";
import { useIsoLayoutEffect } from "@/components/chat/use-iso-layout-effect";

const MORPH_MS = 120;
const FADE_MS = 160;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const HEIGHT_CHANGE_PX = 1;

interface DockMorphInput {
	shellRef: RefObject<HTMLDivElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
	stateKey: string;
	expanded: boolean;
	measureBlock: () => void;
}

export function useDockMorph({ shellRef, contentRef, stateKey, expanded, measureBlock }: DockMorphInput): void {
	const previousExpanded = useRef(expanded);

	useIsoLayoutEffect(() => {
		if (previousExpanded.current === expanded) return;
		previousExpanded.current = expanded;
		contentRef.current?.animate(
			[
				{ opacity: 0, transform: "translateY(6px)" },
				{ opacity: 1, transform: "translateY(0)" },
			],
			{ duration: FADE_MS, easing: EASING },
		);
	}, [expanded]);

	const previous = useRef<{ key: string; height: number } | null>(null);

	useIsoLayoutEffect(() => {
		const shell = shellRef.current;
		if (!shell) return;
		const settled = previous.current;
		// Animated heights read back as the in-flight value, so the height is measured only at rest.
		if (settled && settled.key === stateKey) {
			if (shell.getAnimations().length === 0) {
				settled.height = shell.getBoundingClientRect().height;
				measureBlock();
			}
			return;
		}
		shell.getAnimations().forEach((animation) => animation.cancel());
		const height = shell.getBoundingClientRect().height;
		measureBlock();
		if (settled && Math.abs(settled.height - height) > HEIGHT_CHANGE_PX) {
			shell.animate([{ height: `${settled.height}px` }, { height: `${height}px` }], {
				duration: MORPH_MS,
				easing: EASING,
			});
		}
		previous.current = { key: stateKey, height };
	});
}
