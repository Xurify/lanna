import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export function useServerValue<T>(fromServer: T): [T, Dispatch<SetStateAction<T>>] {
	const [held, setHeld] = useState({ value: fromServer, followed: fromServer, changedHere: false });
	if (!held.changedHere && held.followed !== fromServer)
		setHeld({ value: fromServer, followed: fromServer, changedHere: false });
	const setValue = useCallback<Dispatch<SetStateAction<T>>>(
		(next) =>
			setHeld((h) => ({
				value: typeof next === "function" ? (next as (prev: T) => T)(h.value) : next,
				followed: h.followed,
				changedHere: true,
			})),
		[],
	);
	return [held.changedHere || held.followed === fromServer ? held.value : fromServer, setValue];
}
