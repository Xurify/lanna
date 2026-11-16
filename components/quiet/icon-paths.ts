/** The Quiet tool mockup's icon set (r3-3-quiet/_src/icons.svg), path markup by name, 24x24 box. */
export const ICON_PATHS = {
	review: '<rect x="4" y="8" width="13" height="11" rx="2"/><path d="M8 5h10a2 2 0 0 1 2 2v9"/>',
	listen: '<path d="M4 11v2M7.5 8v8M11 5v14M14.5 8.5v7M18 10v4M21 11.5v1"/>',
	grammar: '<path d="M5 19 10.5 5h1L17 19M7.4 13.5h7.8"/><path d="M19 5.5c.8 1 .8 2.4 0 3.5"/>',
	words: '<path d="M4 12.5 11.5 5H19v7.5L11.5 20z"/><circle cx="15.2" cy="8.8" r="1.2"/>',
	read: '<path d="M3 6.5c3-1.2 6-1 9 1 3-2 6-2.2 9-1v12c-3-1.2-6-1-9 1-3-2-6-2.2-9-1z"/><path d="M12 7.5v12"/>',
	tutor:
		'<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/>',
	fast: '<path d="M4.5 7l5 5-5 5M12 7l5 5-5 5"/><path d="M20 6v12"/>',
	speak: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
	send: '<path d="M5 12h13M13 6l6 6-6 6"/>',
	play: '<path d="M8 5.5v13l10.5-6.5z"/>',
	ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 6.5a3 3 0 0 1-5.5 1.7"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
	rule: '<path d="M5 6h14M5 12h9M5 18h6"/><path d="M16 15l2 2 3.5-4"/>',
	letter: '<path d="M4 18 8 6h1l4 12M5.4 14h6.2"/><path d="M15 18h5"/>',
	dunno: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.6v.1"/>',
	sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	flag: '<path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6"/>',
	key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
	search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
	gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
	mix: '<path d="M4 7h4l8 10h4M4 17h4l8-10h4"/>',
	chart: '<path d="M4 19h16M7 16V10M12 16V6M17 16v-4"/>',
	enter: '<path d="M19 5v7a2 2 0 0 1-2 2H6"/><path d="M9.5 10.5 6 14l3.5 3.5"/>',
	chev: '<path d="M9.5 6l6 6-6 6"/>',
	arrow: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
} as const;

export type QIconName = keyof typeof ICON_PATHS;
