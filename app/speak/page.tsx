import { redirect } from "next/navigation";
import { SpeakHome, SPEAK_HOME_VARIANTS, type SpeakHomeVariant } from "@/components/speak/speak-home";
import { VariantPicker } from "@/components/variant-picker";
import { liveAvailabilityNow } from "@/src/server";

export const metadata = { title: "Speak" };

export const dynamic = "force-dynamic";

/** The four ways to speak. Older links that open a scene (`?scene=`, `?mode=`) now live under /speak/tutor. */
export default async function SpeakPage({
	searchParams,
}: {
	searchParams: Promise<{ scene?: string; mode?: string; __variant?: string }>;
}) {
	const { scene, mode, __variant } = await searchParams;
	if (scene || mode) {
		const forward = new URLSearchParams();
		if (scene) forward.set("scene", scene);
		if (mode) forward.set("mode", mode);
		redirect(`/speak/tutor?${forward.toString()}`);
	}
	const variant = (SPEAK_HOME_VARIANTS.find((v) => v.id === __variant)?.id ?? "gallery") as SpeakHomeVariant;
	return (
		<>
			<SpeakHome live={liveAvailabilityNow()} variant={variant} />
			<VariantPicker groups={[{ label: "Structure", variants: SPEAK_HOME_VARIANTS }]} value={variant} />
		</>
	);
}
