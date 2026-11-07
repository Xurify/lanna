"use client";

import { createContext, useContext } from "react";

/** The ids of the videos being prepared right now (the shelf's own request and
 *  the background tasks), so a card's Prepare button can say so where it was pressed. */
export const PreparingContext = createContext<ReadonlySet<string>>(new Set());

export function usePreparing(id: string): boolean {
	return useContext(PreparingContext).has(id);
}
