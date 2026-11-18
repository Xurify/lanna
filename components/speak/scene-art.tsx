import { CoverScene } from "@/components/reading/cover-scene";
import { cn } from "@/lib/utils";
import { coverMotif, type CoverMotif } from "@/src/core";

const SCENE_MOTIFS: Record<string, CoverMotif> = {
	cafe: "cup",
	way: "city",
	colleague: "office",
	shop: "market",
	doctor: "clinic",
	family: "family",
	station: "train",
	restaurant: "plate",
	hotel: "mountains",
};

function seedOf(text: string): number {
	let h = 7;
	for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 9973;
	return h * 2;
}

export function sceneMotif(id: string, text: string): CoverMotif {
	return SCENE_MOTIFS[id] ?? coverMotif(text, seedOf(id));
}

export function SceneArt({ id, text, className }: { id: string; text: string; className?: string }) {
	return (
		<CoverScene
			motif={sceneMotif(id, text)}
			seed={seedOf(id)}
			className={cn("block w-full [&_[class*=q-wash-]]:hidden", className)}
		/>
	);
}
