/** The activity feed the sidebar dock and the Tasks page read: the app's running and finished background tasks. */

import { listTasks, type TaskRecord } from "./tasks.ts";

export function activityFeed(): { tasks: TaskRecord[] } {
	return { tasks: listTasks() };
}
