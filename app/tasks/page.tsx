import { TasksPage } from "@/components/tasks-page";

export const metadata = { title: "Tasks" };

/** Tasks: the background tasks, running and finished. The list is the
 *  activity feed, read on the client, so it updates without a reload. */
export default function TasksRoute() {
	return <TasksPage />;
}
