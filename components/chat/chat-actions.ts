import { createContext } from "react";

export interface ChatActions {
	chatId: string;
	syncFromServer: () => Promise<void>;
	openSetup: () => void;
}

export const ChatActionsContext = createContext<ChatActions | null>(null);
