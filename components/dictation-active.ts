/* Is a dictation run live on this page? The Esc chain (keyboard wave A,
 * components/keyboard-shortcuts.tsx) needs a SYNCHRONOUS answer — the
 * stop handler can't report back through a CustomEvent. Set at start(),
 * cleared in cleanup() (every terminal path runs through cleanup). */
let dictationActiveFlag = false;

export function isDictationActive(): boolean {
	return dictationActiveFlag;
}

export function setDictationActive(active: boolean): void {
	dictationActiveFlag = active;
}
