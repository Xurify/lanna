import { SourcesPage } from "@/components/sources/sources-page";

export const metadata = { title: "Sources" };

/** The research behind every task, by feature (DECISIONS E59). Static: the
 *  text is in src/core/sources.ts. */
export default function SourcesRoute() {
	return <SourcesPage />;
}
