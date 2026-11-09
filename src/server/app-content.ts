import { NAV } from "../../lib/nav.ts";
import { appContentText } from "../core/app-content.ts";
import { curriculumState } from "../core/curriculum.ts";
import { SPEAK_SCENES } from "../core/speak.ts";
import { cheatsheetStore } from "../store/cheatsheets.ts";
import { defaultGoal, progressStore } from "../store/progress.ts";
import { storyStore } from "../store/stories.ts";
import { sceneFor } from "./speak.ts";

export function appContentNow(): string {
	const p = progressStore.read();
	const goal = p.goal ?? defaultGoal();
	const read = <T>(list: () => T[]): T[] => {
		try {
			return list();
		} catch {
			return [];
		}
	};
	return appContentText({
		pages: NAV.flatMap((g) => g.items).filter((i) => i.id !== "ask"),
		state: curriculumState(p.units, goal.level, { startChapter: goal.startChapter }),
		scenes: SPEAK_SCENES.flatMap((s) => {
			const scene = sceneFor(s.id);
			return scene ? [{ id: scene.id, title: scene.title, blurb: scene.blurb }] : [];
		}),
		sheets: read(() => cheatsheetStore.list()),
		stories: read(() => storyStore.list()),
	});
}
