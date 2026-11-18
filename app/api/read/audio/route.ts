/**
 * GET /api/read/audio — how many stories already have ElevenLabs audio for
 * every sentence, what the rest would cost, and the batch being made.
 * POST /api/read/audio — make the missing clips in the background
 * (src/server/story-audio.ts); 409 while a batch runs or with no key.
 */

import { revoiceStories, startStoryAudio, StoryAudioError, storyAudioStatus } from "@/src/server";

export const dynamic = "force-dynamic";

export function GET() {
	return Response.json(storyAudioStatus());
}

export async function POST() {
	await revoiceStories();
	try {
		void startStoryAudio();
	} catch (err) {
		if (err instanceof StoryAudioError) return Response.json({ message: err.message }, { status: 409 });
		throw err;
	}
	return Response.json(storyAudioStatus(), { status: 202 });
}
