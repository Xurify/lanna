"use client";

import { useEffect, useRef, useState } from "react";
import { HeadphonesIcon, MonitorPlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSpotifyId } from "@/src/core";

/** YouTube's sizes of a thumbnail, best first. `maxresdefault` is 1280×720 and
 *  only exists for videos uploaded in HD; `sddefault` (640×480) and
 *  `hqdefault` (480×360) are 4:3 with black bars above and below the 16:9
 *  picture, which `object-cover` in a 16:9 box crops away exactly. */
const SIZES = ["maxresdefault", "sddefault", "hqdefault"] as const;

/** YouTube answers a size a video does not have with a 120×90 grey stand-in
 *  (status 404, but a picture, so the browser reports it as loaded). */
const STAND_IN_WIDTH = 120;

/** A video's YouTube thumbnail in a 16:9 box that fills its parent's width, so
 *  a row or a card does not move when the image arrives. Loaded from YouTube's
 *  image host in the browser. It steps down through the sizes when one is
 *  missing, fades in when it has loaded, and shows the icon when YouTube has
 *  none at all. */
export function Poster({ id, watched = false, className }: { id: string; watched?: boolean; className?: string }) {
	const spotify = isSpotifyId(id);
	const [at, setAt] = useState({ id, size: 0, loaded: false });
	// The same card showing another video starts from the best size again.
	const size = at.id === id ? at.size : 0;
	const loaded = at.id === id && at.loaded;
	const maxSteps = spotify ? 1 : SIZES.length;
	const next = () => setAt({ id, size: size + 1, loaded: false });
	const img = useRef<HTMLImageElement>(null);
	const settle = (el: HTMLImageElement) => (!spotify && el.naturalWidth <= STAND_IN_WIDTH ? next() : setAt({ id, size, loaded: true }));
	// A picture that finished (or failed) before the page was interactive fired its events to nobody.
	useEffect(() => {
		if (img.current?.complete && !loaded) settle(img.current);
	}, [id, size]);
	return (
		<span className={cn("relative block aspect-video w-full overflow-hidden bg-well-2", className)}>
			{size >= maxSteps ? (
				<span className={cn("absolute inset-0 flex items-center justify-center", watched ? "text-ink-3" : "bg-teal-wash text-teal-2")}>
					{spotify ? <HeadphonesIcon className="size-7" strokeWidth={1.5} /> : <MonitorPlayIcon className="size-7" strokeWidth={1.5} />}
				</span>
			) : (
				// next/image would need YouTube's image host allowed in its config; the plain image needs no setup.
				// eslint-disable-next-line @next/next/no-img-element
				<img
					ref={img}
					key={`${id}-${size}`}
					src={spotify ? `/api/watch/audio?id=${encodeURIComponent(id)}&cover=1` : `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${SIZES[size]}.jpg`}
					alt=""
					loading="lazy"
					decoding="async"
					onError={next}
					onLoad={(e) => settle(e.currentTarget)}
					className={cn("absolute inset-0 size-full object-cover transition-opacity duration-200 motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}
				/>
			)}
		</span>
	);
}
