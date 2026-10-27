import { Home } from "@/components/home";
import { readSettingsRecord } from "@/src/server";
import { resolveSettings, slotsConfigured } from "@/src/core";

// The knowledge map — the graph home LearnHarness opened on. LangHarness
// opens on Today (app/page.tsx); the map stays one click away.
export const dynamic = "force-dynamic";

export default function MapPage() {
	const record = readSettingsRecord();
	const rendering = resolveSettings(record ?? null).graph.rendering;
	return <Home initialConfigured={slotsConfigured(record?.models)} rendering={rendering} />;
}
