import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PATHS } from "@/config";
import { isSpotifyId } from "@/src/core";

export function GET(request: Request) {
	const url = new URL(request.url);
	const id = url.searchParams.get("id")?.trim() ?? "";
	if (!isSpotifyId(id)) {
		return NextResponse.json({ message: "Not a Spotify track id" }, { status: 400 });
	}
	const isCover = url.searchParams.get("cover") === "1";
	const audioDir = path.join(PATHS.videos, "audio");
	if (isCover) {
		const coverPath = path.join(audioDir, `${id}.jpg`);
		if (!fs.existsSync(coverPath)) {
			return new Response(null, { status: 404 });
		}
		const buf = fs.readFileSync(coverPath);
		return new Response(buf, {
			status: 200,
			headers: {
				"content-type": "image/jpeg",
				"content-length": String(buf.byteLength),
				"cache-control": "public, max-age=86400",
			},
		});
	}

	const mp3Path = path.join(audioDir, `${id}.mp3`);
	if (!fs.existsSync(mp3Path)) {
		return NextResponse.json({ message: "Audio file not found" }, { status: 404 });
	}
	const stat = fs.statSync(mp3Path);
	const total = stat.size;
	const range = request.headers.get("range");
	if (range) {
		// RFC 9110 §14.1.2 bytes=start-end range header for HTML5 <audio> seeking.
		const m = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
		if (m) {
			const start = m[1] ? Number.parseInt(m[1], 10) : 0;
			const end = m[2] ? Math.min(total - 1, Number.parseInt(m[2], 10)) : total - 1;
			if (start >= 0 && start < total && start <= end) {
				const length = end - start + 1;
				const fd = fs.openSync(mp3Path, "r");
				const buf = Buffer.alloc(length);
				try {
					fs.readSync(fd, buf, 0, length, start);
				} finally {
					fs.closeSync(fd);
				}
				return new Response(buf, {
					status: 206,
					headers: {
						"content-type": "audio/mpeg",
						"content-length": String(length),
						"content-range": `bytes ${start}-${end}/${total}`,
						"accept-ranges": "bytes",
						"cache-control": "public, max-age=86400",
					},
				});
			}
		}
	}

	const buf = fs.readFileSync(mp3Path);
	return new Response(buf, {
		status: 200,
		headers: {
			"content-type": "audio/mpeg",
			"content-length": String(buf.byteLength),
			"accept-ranges": "bytes",
			"cache-control": "public, max-age=86400",
		},
	});
}
