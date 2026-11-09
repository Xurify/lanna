import { redirect } from "next/navigation";

export default function LegacyExperimentRedirect() {
	redirect("/experiments/input-first");
}
