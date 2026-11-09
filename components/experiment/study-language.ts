import { catalogLanguage, languageById } from "@/src/core";

export interface StudyLanguage {
	id: string;
	name: string;
	code: string | undefined;
	tag: string | undefined;
}

export function studyLanguage(id: string): StudyLanguage {
	const info = languageById(id) ?? catalogLanguage(id);
	return { id, name: info?.english ?? id.charAt(0).toUpperCase() + id.slice(1), code: info?.code, tag: info?.tag };
}

export const STUDY_ROUTE = "/experiments/input-first";
export const CHECK_ROUTE = `${STUDY_ROUTE}/check`;
