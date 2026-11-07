/**
 * The right-click menu of the app window (2026-11-07). Electron shows no
 * context menu at all unless the shell builds one, so a YouTube card's link
 * could only be clicked (and opened in the default browser), never copied
 * to paste into another browser. A link to another site gets "Copy link"
 * and "Open in browser"; selected text gets Copy; a text field gets the
 * editing items. A page that handles its own right-click (the sidebar's
 * chat menu) calls preventDefault, and Chromium then sends no event here.
 */

"use strict";

/** The menu for one right-click, as Menu.buildFromTemplate takes it; empty means no menu.
 *  `act` carries the side effects so the template stays testable without Electron. */
function contextMenuTemplate(params, ownOrigin, act) {
	const items = [];
	let link = null;
	try {
		const u = params.linkURL ? new URL(params.linkURL) : null;
		if (u && (u.protocol === "https:" || u.protocol === "http:") && u.origin !== ownOrigin) link = u.toString();
	} catch {
		link = null;
	}
	if (link) {
		items.push({ label: "Copy link", click: () => act.copy(link) });
		items.push({ label: "Open in browser", click: () => act.open(link) });
	}
	const editing = [];
	if (params.isEditable) {
		editing.push({ role: "cut", enabled: !!params.editFlags?.canCut }, { role: "copy", enabled: !!params.editFlags?.canCopy }, { role: "paste", enabled: !!params.editFlags?.canPaste }, { type: "separator" }, { role: "selectAll" });
	} else if ((params.selectionText ?? "").trim()) {
		editing.push({ role: "copy" });
	}
	if (items.length && editing.length) items.push({ type: "separator" });
	return [...items, ...editing];
}

/** Show the menu on every right-click the page leaves to the shell. */
function attachContextMenu(win, ownOrigin, { Menu, clipboard, shell }) {
	win.webContents.on("context-menu", (_event, params) => {
		const template = contextMenuTemplate(params, ownOrigin(), {
			copy: (text) => clipboard.writeText(text),
			open: (url) => void shell.openExternal(url),
		});
		if (template.length) Menu.buildFromTemplate(template).popup({ window: win });
	});
}

module.exports = { contextMenuTemplate, attachContextMenu };
