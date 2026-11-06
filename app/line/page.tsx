import { LinePage } from "@/components/line/line-page";
import { lineState } from "@/src/server";

export const metadata = { title: { absolute: "Today's line · LangHarness" } };

// Dynamic: the morning hearing and the evening replay depend on the day's record.
export const dynamic = "force-dynamic";

export default function LineRoute() {
	return <LinePage initial={lineState()} />;
}
