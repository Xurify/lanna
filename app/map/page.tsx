import { MapPage } from "@/components/map/map-page";
import { readSettingsRecord } from "@/src/server";
import { resolveSettings, slotsConfigured } from "@/src/core";

export const metadata = { title: "Map" };

// The Map: the rules the lessons teach, by area (first view), and the
// knowledge graph LearnHarness opened on (second view).
export const dynamic = "force-dynamic";

export default async function MapRoute({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
	const { view } = await searchParams;
	const record = readSettingsRecord();
	const rendering = resolveSettings(record ?? null).graph.rendering;
	return <MapPage initialView={view === "graph" ? "graph" : "rules"} initialConfigured={slotsConfigured(record?.models)} rendering={rendering} />;
}
