import { redirect } from "next/navigation";
import { SpeakHome } from "@/components/speak/speak-home";
import { liveAvailabilityNow } from "@/src/server";

export const metadata = { title: "Speak" };

export const dynamic = "force-dynamic";

/** The four ways to speak. Older links that open a scene (`?scene=`, `?mode=`) now live under /speak/tutor. */
export default async function SpeakPage({
	searchParams,
}: {
	searchParams: Promise<{ scene?: string; mode?: string }>;
}) {
	const { scene, mode } = await searchParams;
	if (scene || mode) {
		const forward = new URLSearchParams();
		if (scene) forward.set("scene", scene);
		if (mode) forward.set("mode", mode);
		redirect(`/speak/tutor?${forward.toString()}`);
	}
	return <SpeakHome live={liveAvailabilityNow()} />;
}
