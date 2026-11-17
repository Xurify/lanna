/** YouTube's IFrame Player API, shared by the Watch screen and the notes editor. */

export interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	getCurrentTime(): number;
	setPlaybackRate(rate: number): void;
	destroy(): void;
	/** Undocumented but long-standing: drops the player's own caption
	 *  module, so a track the viewer left switched on does not show the
	 *  line we are hiding. */
	unloadModule?(name: string): void;
}
export interface PlayerEvents {
	onReady: () => void;
	onStateChange: (e: { data: number }) => void;
	onError: (e: { data: number }) => void;
}
/** YouTube's IFrame API state numbers; the audio player reports the same. */
export const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;
export const PLAYER_ERROR_AUDIO = -1;
export interface YTNamespace {
	Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
}

declare global {
	interface Window {
		YT?: YTNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let apiPromise: Promise<YTNamespace> | null = null;

/** YouTube's IFrame Player API, loaded once. */
export function loadYouTubeApi(): Promise<YTNamespace> {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise<YTNamespace>((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT) resolve(window.YT);
		};
		const s = document.createElement("script");
		s.src = "https://www.youtube.com/iframe_api";
		s.async = true;
		s.onerror = () => {
			apiPromise = null;
			reject(new Error("YouTube's player did not load. Is the internet on?"));
		};
		document.head.appendChild(s);
		setTimeout(() => {
			if (!window.YT?.Player) {
				apiPromise = null;
				reject(new Error("YouTube's player did not load. Is the internet on?"));
			}
		}, 20_000);
	});
	return apiPromise;
}
