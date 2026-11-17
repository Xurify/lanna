import { useEffect, useLayoutEffect } from "react";

// Client components still render on the server in Next, where useLayoutEffect logs a warning.
export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
