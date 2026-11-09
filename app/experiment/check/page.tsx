import { redirect } from "next/navigation";

export default function LegacyExperimentCheckRedirect() {
	redirect("/experiments/input-first/check");
}
