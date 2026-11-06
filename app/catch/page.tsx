import { CatchPlayer } from "@/components/catch/catch-player";

export const metadata = { title: "Catch the mistake" };

export const dynamic = "force-dynamic";

/** Catch the mistake: a short item with one wrong word. The page renders the card at once and the item comes from /api/catch, when the learner starts. */
export default function CatchPage() {
	return <CatchPlayer />;
}
