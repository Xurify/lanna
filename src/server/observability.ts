import { listTasks, type TaskRecord } from "./tasks.ts";

export function activityFeed(): { tasks: TaskRecord[] } {
	return { tasks: listTasks() };
}
