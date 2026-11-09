import type { Metadata } from "next";
import { EarGym } from "@/components/phonology/ear-gym";

export const metadata: Metadata = {
	title: "Ear gym",
	description: "Hear one word of a pair and pick which one it was",
};

export const dynamic = "force-dynamic";

export default function PhonologyPage() {
	return <EarGym seed={Date.now()} />;
}
