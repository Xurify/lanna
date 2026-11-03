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

/** The speaker button in a lesson or Review header. A click mutes or
 *  unmutes. Hovering it, focusing it, right-clicking it or pressing and
 *  holding it on a touch screen drops a vertical volume slider below it. */
export function SoundControl({ className, iconClass = "size-5", testid = "sound-toggle" }: { className?: string; iconClass?: string; testid?: string }) {
	const { on, level } = useSound();
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const closeTimer = useRef<number | undefined>(undefined);
	const pressTimer = useRef<number | undefined>(undefined);
	const swallowClick = useRef(false);

	const show = () => {
		window.clearTimeout(closeTimer.current);
		setOpen(true);
	};
	const hideSoon = () => {
		window.clearTimeout(closeTimer.current);
		closeTimer.current = window.setTimeout(() => setOpen(false), 350);
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
			window.clearTimeout(pressTimer.current);
		},
		[],
	);

	const toggle = () => {
		if (swallowClick.current) {
			swallowClick.current = false;
			return;
		}
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
			onPointerEnter={(e) => e.pointerType === "mouse" && show()}
			onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
			onFocus={show}
			onBlur={(e) => {
				if (!root.current?.contains(e.relatedTarget as Node)) hideSoon();
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
				onPointerUp={() => window.clearTimeout(pressTimer.current)}
				onPointerCancel={() => window.clearTimeout(pressTimer.current)}
				aria-label={on ? "Mute sound and speech" : "Turn sound and speech on"}
				aria-expanded={open}
				title="Click to mute. Hover or right-click for volume."
				data-testid={testid}
				className={cn("rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground", className)}
			>
				<Icon className={iconClass} />
			</button>
			{/* Absolute, so opening it never moves the header. The padding keeps the hover alive across the gap. */}
			{open && (
				<div role="group" aria-label="Volume" data-testid="volume-popover" className="absolute left-1/2 top-full z-30 -translate-x-1/2 pt-2">
					<div className="flex w-12 flex-col items-center gap-1 rounded-xl border border-border/70 bg-card py-2 shadow-raise">
						<Slider value={on ? level : 0} onChange={move} onCommit={() => sfx.tap()} label="Volume" orientation="vertical" className="h-28 flex-none" testid="volume-slider" />
						<span className="font-ui text-[11px] font-semibold tabular-nums text-muted-foreground">{on ? Math.round(level * 100) : 0}%</span>
					</div>
				</div>
			)}
		</div>
	);
}
