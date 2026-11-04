"use client";

/**
 * Where each unit's first tries sit against the zone (src/core/flow.ts),
 * handed down once so the path, the climb and their rows can mark a unit
 * without every layer passing the record along.
 */

import { createContext, useContext } from "react";
import type { UnitZone } from "@/src/core";

const FlowContext = createContext<Record<string, UnitZone>>({});

export const FlowZonesProvider = FlowContext.Provider;

export function useUnitZone(unit: string): UnitZone | undefined {
	const z = useContext(FlowContext)[unit];
	return z && z.zone !== "new" ? z : undefined;
}
