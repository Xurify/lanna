import type { Metadata } from "next";
import { EarGym } from "@/components/phonology/ear-gym";

export const metadata: Metadata = {
	title: "Ear Gym · Minimal Pairs",
	description: "High-Variability Phonetic Training for second-language speech perception",
};

export const dynamic = "force-dynamic";

/** Ear Gym: High-Variability Phonetic Training (HVPT) minimal pairs for perceptual attunement. */
export default function PhonologyPage() {
	return <EarGym />;
}
