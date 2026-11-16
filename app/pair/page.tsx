import type { Metadata } from "next";
import { PairForm } from "@/components/pair/pair-form";

export const metadata: Metadata = {
	title: "Pair this device",
	robots: { index: false, follow: false },
};

/** Pairing (E21): the one page an unpaired phone or iPad can open while remote access is on. */
export default async function PairPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
	const { next } = await searchParams;
	return <PairForm next={safeNext(typeof next === "string" ? next : undefined)} />;
}

/** Where to go once paired: a path inside the app. Never another origin, and never back to this page. */
function safeNext(path: string | undefined): string {
	if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || path.startsWith("/pair"))
		return "/";
	return path;
}
