"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { setSoundOn, setVolume, sfx, soundOn, subscribeSound, volume } from "@/components/lesson/sound";
import { stopSpeaking } from "@/components/speech";

/** Reads the sound switch and the volume; the server render assumes full volume, so the first paint never differs. */
export function useSound(): { on: boolean; level: number } {
	const on = useSyncExternalStore(subscribeSound, soundOn, () => true);
	const level = useSyncExternalStore(subscribeSound, volume, () => 1);
	return { on, level };
}

const LONG_PRESS_MS = 450;
/** Resting on the button this long means "I want the volume"; passing over it on the way to somewhere else does not. */
const HOVER_INTENT_MS = 700;

/** The speaker button in a lesson or Review header. A click mutes or
 *  unmutes and nothing else happens. The volume, a horizontal slider, opens
 *  when the pointer rests on the button for a moment, on a right-click, on a
 *  press and hold on a touch screen, or from the keyboard (Up and Down change
 *  it). Moving the wheel over the button changes it too. */
export function SoundControl({
	className,
	iconClass = "size-5",
	testid = "sound-toggle",
}: {
	className?: string;
	iconClass?: string;
	testid?: string;
}) {
	const { on, level } = useSound();
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const closeTimer = useRef<number | undefined>(undefined);
	const hoverTimer = useRef<number | undefined>(undefined);
	const pressTimer = useRef<number | undefined>(undefined);
	const swallowClick = useRef(false);
	const pointerInside = useRef(false);

	const show = () => {
		window.clearTimeout(closeTimer.current);
		setOpen(true);
	};
	const hideSoon = () => {
		window.clearTimeout(hoverTimer.current);
		window.clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(() => setOpen(false), 500);
	};

	useEffect(() => {
		if (!open) return;
		const away = (e: PointerEvent) => {
			if (!root.current?.contains(e.target as Node)) setOpen(false);
		};
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("pointerdown", away);
		document.addEventListener("keydown", esc);
		return () => {
			document.removeEventListener("pointerdown", away);
			document.removeEventListener("keydown", esc);
		};
	}, [open]);

	useEffect(
		() => () => {
			window.clearTimeout(closeTimer.current);
			window.clearTimeout(hoverTimer.current);
			window.clearTimeout(pressTimer.current);
		},
		[],
	);

	const toggle = () => {
		if (swallowClick.current) {
			swallowClick.current = false;
			return;
		}
		// A click is only a mute: cancel a pending hover and fold an open slider.
		window.clearTimeout(hoverTimer.current);
		setOpen(false);
		const next = !on;
		setSoundOn(next);
		// Turning sound off silences a sentence that is already playing.
		if (!next) stopSpeaking();
	};

	const move = (next: number) => {
		setVolume(next);
		// Moving the slider while muted is a request to hear it.
		if (!soundOn()) setSoundOn(true);
	};

	const Icon = !on || level === 0 ? VolumeXIcon : level < 0.5 ? Volume1Icon : Volume2Icon;

	return (
		<div
			ref={root}
			className="relative"
			onPointerEnter={(e) => {
				if (e.pointerType !== "mouse") return;
				pointerInside.current = true;
				window.clearTimeout(closeTimer.current);
				if (!open) hoverTimer.current = window.setTimeout(show, HOVER_INTENT_MS);
			}}
			onPointerLeave={(e) => {
				if (e.pointerType !== "mouse") return;
				pointerInside.current = false;
				hideSoon();
			}}
			onBlur={(e) => {
				if (!root.current?.contains(e.relatedTarget as Node) && !pointerInside.current) hideSoon();
			}}
			onWheel={(e) => {
				move(Math.min(1, Math.max(0, volume() + (e.deltaY < 0 ? 0.05 : -0.05))));
				show();
			}}
		>
			<button
				type="button"
				onClick={toggle}
				onContextMenu={(e) => {
					e.preventDefault();
					show();
				}}
				onPointerDown={(e) => {
					if (e.pointerType !== "touch") return;
					pressTimer.current = window.setTimeout(() => {
						swallowClick.current = true;
						show();
					}, LONG_PRESS_MS);
				}}
				onKeyDown={(e) => {
					if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
					e.preventDefault();
					move(Math.min(1, Math.max(0, volume() + (e.key === "ArrowUp" ? 0.1 : -0.1))));
					show();
				}}
				onPointerUp={() => window.clearTimeout(pressTimer.current)}
				onPointerCancel={() => window.clearTimeout(pressTimer.current)}
				aria-label={on ? "Mute sound and speech" : "Turn sound and speech on"}
				aria-expanded={open}
				title="Click to mute. Right-click, or rest here, for volume."
				data-testid={testid}
				className={cn("rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground", className)}
			>
				<Icon className={iconClass} />
			</button>
			{/* Absolute, so opening it never moves the header. The padding keeps the hover alive across the gap. */}
			{open && (
				<div
					role="group"
					aria-label="Volume"
					data-testid="volume-popover"
					className="absolute right-0 top-full z-30 pt-2"
				>
					<div className="flex w-48 items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-2.5 shadow-raise">
						<Slider
							value={on ? level : 0}
							onChange={move}
							onCommit={() => sfx.tap()}
							label="Volume"
							className="flex-1"
							testid="volume-slider"
						/>
						<span className="w-9 text-right font-ui text-xs font-semibold tabular-nums text-muted-foreground">
							{on ? Math.round(level * 100) : 0}%
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
