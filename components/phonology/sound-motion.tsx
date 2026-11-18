"use client";

import { useEffect, useState } from "react";
import type { SoundPicture } from "@/src/core";
import { LengthWave, Mouth } from "./mouth";
import { mouthMotionAt, mouthMotionMs } from "./mouth-paths";

function usePlayCount(playing: boolean): number {
	const [seen, setSeen] = useState(playing);
	const [plays, setPlays] = useState(0);
	if (seen !== playing) {
		setSeen(playing);
		if (playing) setPlays(plays + 1);
	}
	return plays;
}

function useElapsedMs(play: number, lastsMs: number): number | null {
	const [elapsed, setElapsed] = useState<number | null>(null);
	useEffect(() => {
		if (play === 0 || lastsMs <= 0) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const startedAt = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			const passed = now - startedAt;
			if (passed >= lastsMs) {
				setElapsed(null);
				return;
			}
			setElapsed(passed);
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [play, lastsMs]);
	return elapsed;
}

export function LiveSoundDrawing({
	picture,
	seed,
	quiet = false,
	playing,
	className,
}: {
	picture: SoundPicture;
	seed: number;
	quiet?: boolean;
	playing: boolean;
	className?: string;
}) {
	const plays = usePlayCount(playing);
	const mouth = picture.kind === "mouth" ? picture.mouth : null;
	const elapsed = useElapsedMs(plays, mouth ? mouthMotionMs(mouth) : 0);
	if (picture.kind === "length")
		return <LengthWave units={picture.units} seed={seed} quiet={quiet} replay={plays} className={className} />;
	return (
		<Mouth
			spec={picture.mouth}
			seed={seed}
			quiet={quiet}
			motion={elapsed === null ? undefined : mouthMotionAt(picture.mouth, elapsed)}
			className={className}
		/>
	);
}
