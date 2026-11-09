import { useState, type Dispatch, type SetStateAction } from "react";

export function useServerValue<T>(fromServer: T): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState(fromServer);
	const [followed, setFollowed] = useState(fromServer);
	if (followed !== fromServer) {
		setFollowed(fromServer);
		setValue(fromServer);
	}
	return [value, setValue];
}
