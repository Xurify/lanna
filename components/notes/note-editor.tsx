"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { AtSignIcon, GlobeIcon, LayoutPanelTopIcon, LinkIcon, PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { belongsToLayoutAccent, formatClock, mentionMarkdown, pastedLink, stampFor, type NoteLink } from "@/src/core";

export interface NoteEditorHandle {
	insertStamp: (sec: number) => void;
	focusEnd: () => void;
}

interface Props {
	initial: string;
	placeholder: string;
	autoFocus: boolean;
	hasVideo: boolean;
	onChange: (markdown: string) => void;
	onBlur: () => void;
	onSeek: (sec: number) => void;
	onStampKey: () => void;
	onCard: (url: string) => void;
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

const previews = new Map<string, Promise<NoteLink | null>>();

/** A link's card, asked once per page load; the server keeps it in link-previews.json. */
export function previewOf(url: string): Promise<NoteLink | null> {
	let p = previews.get(url);
	if (!p) {
		p = fetch(`/api/notes/preview?url=${encodeURIComponent(url)}`)
			.then((r) => (r.ok ? (r.json() as Promise<{ card: NoteLink }>) : null))
			.then((x) => x?.card ?? null)
			.catch(() => null);
		previews.set(url, p);
	}
	return p;
}

// ─── Mention: a link shown as the page's icon and title ─────────────────────

function MentionChip({ node, updateAttributes }: NodeViewProps) {
	const url = String(node.attrs.url ?? "");
	const title = String(node.attrs.title ?? "");
	const [card, setCard] = useState<NoteLink | null>(null);
	const [iconFailed, setIconFailed] = useState(false);

	useEffect(() => {
		let alive = true;
		void previewOf(url).then((c) => {
			if (!alive || !c) return;
			setCard(c);
			if (!title && c.title) updateAttributes({ title: c.title });
		});
		return () => {
			alive = false;
		};
	}, [url, title, updateAttributes]);

	const shown = title || card?.title || hostOf(url);
	return (
		<NodeViewWrapper as="span" className="inline">
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				contentEditable={false}
				draggable={false}
				title={url}
				className="mx-px inline-flex max-w-full translate-y-[-1px] items-baseline gap-1.5 rounded-md px-1 align-baseline font-ui text-[0.92em] font-[550] text-foreground no-underline decoration-ink-4/50 underline-offset-[3px] hover:bg-well hover:underline"
				data-mention=""
				data-testid="notes-mention"
			>
				{card?.icon && !iconFailed ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={card.icon}
						alt=""
						onError={() => setIconFailed(true)}
						className="size-[1em] shrink-0 translate-y-[0.14em] self-baseline rounded-[3px] object-contain"
					/>
				) : card?.videoId ? (
					<PlayIcon className="size-[0.85em] shrink-0 translate-y-[0.1em] fill-current text-teal-2" strokeWidth={0} />
				) : (
					<GlobeIcon className="size-[0.9em] shrink-0 translate-y-[0.12em] text-ink-3" strokeWidth={1.8} />
				)}
				<span className="truncate border-b border-ink-4/30">{shown}</span>
			</a>
		</NodeViewWrapper>
	);
}

const MENTION_SOURCE = /^@\[((?:\\.|[^\]\\\n])*)\]\((https?:\/\/[^\s)]+)\)/;

const LinkMention = Node.create({
	name: "linkMention",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	addAttributes() {
		return { url: { default: "" }, title: { default: "" } };
	},
	parseHTML() {
		return [
			{
				tag: "a[data-mention]",
				getAttrs: (el) => ({ url: el.getAttribute("href") ?? "", title: el.textContent ?? "" }),
			},
		];
	},
	renderHTML({ node }) {
		return ["a", mergeAttributes({ "data-mention": "", href: node.attrs.url }), node.attrs.title || node.attrs.url];
	},
	addNodeView() {
		return ReactNodeViewRenderer(MentionChip, { as: "span" });
	},
	markdownTokenName: "linkMention",
	markdownTokenizer: {
		name: "linkMention",
		level: "inline",
		start: (src: string) => src.indexOf("@["),
		tokenize(src: string) {
			const m = MENTION_SOURCE.exec(src);
			if (!m) return undefined;
			return { type: "linkMention", raw: m[0], title: m[1]!.replace(/\\(.)/g, "$1"), url: m[2]! };
		},
	},
	parseMarkdown(token, h) {
		return h.createNode("linkMention", { url: token.url, title: token.title });
	},
	renderMarkdown(node) {
		const url = String(node.attrs?.url ?? "");
		return mentionMarkdown(String(node.attrs?.title || hostOf(url)), url);
	},
});

// ─── Stamp: a moment in the video, which jumps there ────────────────────────

const STAMP_SOURCE = /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\](?!\()/;

function StampChip({ node, extension }: NodeViewProps) {
	const sec = Number(node.attrs.sec ?? 0);
	return (
		<NodeViewWrapper as="span" className="inline">
			<button
				type="button"
				contentEditable={false}
				onClick={() => (extension.options as { onSeek: (s: number) => void }).onSeek(sec)}
				className="mx-px inline-flex translate-y-[-1px] items-center rounded-md bg-teal-wash px-1.5 align-baseline font-ui text-[0.8em] font-[650] tabular-nums leading-[1.5] text-teal-2 hover:bg-teal-line/60"
				title="Jump the video here"
				data-testid="notes-stamp-chip"
			>
				{formatClock(sec)}
			</button>
		</NodeViewWrapper>
	);
}

const NoteStamp = Node.create<{ onSeek: (sec: number) => void }>({
	name: "noteStamp",
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	addOptions() {
		return { onSeek: () => {} };
	},
	addAttributes() {
		return { sec: { default: 0 } };
	},
	parseHTML() {
		return [{ tag: "span[data-stamp]", getAttrs: (el) => ({ sec: Number(el.getAttribute("data-stamp") ?? 0) }) }];
	},
	renderHTML({ node }) {
		return ["span", { "data-stamp": String(node.attrs.sec) }, stampFor(Number(node.attrs.sec))];
	},
	addNodeView() {
		return ReactNodeViewRenderer(StampChip, { as: "span" });
	},
	markdownTokenName: "noteStamp",
	markdownTokenizer: {
		name: "noteStamp",
		level: "inline",
		start: (src: string) => src.search(/\[\d{1,2}:\d/),
		tokenize(src: string) {
			const m = STAMP_SOURCE.exec(src);
			if (!m) return undefined;
			const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
			if (s > 59 || (m[1] !== undefined && min > 59)) return undefined;
			return { type: "noteStamp", raw: m[0], sec: h * 3600 + min * 60 + s };
		},
	},
	parseMarkdown(token, h) {
		return h.createNode("noteStamp", { sec: token.sec });
	},
	renderMarkdown(node) {
		return stampFor(Number(node.attrs?.sec ?? 0));
	},
});

// ─── The paste menu ─────────────────────────────────────────────────────────

type Choice = "mention" | "card" | "link";

interface PasteMenu {
	url: string;
	from: number;
	to: number;
	left: number;
	top: number;
}

const CHOICES: ReadonlyArray<{ id: Choice; label: string; hint: string; icon: React.ReactNode }> = [
	{
		id: "mention",
		label: "Mention",
		hint: "Icon and title, in the text",
		icon: <AtSignIcon className="size-4" strokeWidth={1.8} />,
	},
	{
		id: "card",
		label: "Card",
		hint: "Preview with a picture, below",
		icon: <LayoutPanelTopIcon className="size-4" strokeWidth={1.8} />,
	},
	{
		id: "link",
		label: "Keep as link",
		hint: "The address, as pasted",
		icon: <LinkIcon className="size-4" strokeWidth={1.8} />,
	},
];

function PasteChoices({
	menu,
	active,
	onPick,
	onHover,
}: {
	menu: PasteMenu;
	active: number;
	onPick: (c: Choice) => void;
	onHover: (i: number) => void;
}) {
	return createPortal(
		<div
			role="listbox"
			aria-label="Paste the link as"
			className="fixed z-50 w-72 rounded-xl bg-popover p-1 shadow-raise-hi"
			style={{ left: menu.left, top: menu.top }}
			onMouseDown={(e) => e.preventDefault()}
			data-testid="notes-paste-menu"
		>
			<p className="px-2.5 pb-1 pt-1.5 font-ui text-[12px] font-[600] text-ink-3">Paste as</p>
			{CHOICES.map((c, i) => (
				<button
					key={c.id}
					type="button"
					role="option"
					aria-selected={i === active}
					onMouseEnter={() => onHover(i)}
					onClick={() => onPick(c.id)}
					className={cn(
						"flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
						i === active ? "bg-well" : "hover:bg-well/60",
					)}
					data-testid={`notes-paste-${c.id}`}
				>
					<span className="text-ink-2">{c.icon}</span>
					<span className="min-w-0 flex-1">
						<span className="block font-ui text-[14px] font-[600] text-foreground">{c.label}</span>
						<span className="block truncate font-prose text-[12.5px] text-ink-3">{c.hint}</span>
					</span>
					{i === 0 && <kbd className="q-kbd hidden pointer-fine:inline-flex">Enter</kbd>}
				</button>
			))}
		</div>,
		document.body,
	);
}

// ─── The editor ─────────────────────────────────────────────────────────────

const PROSE = cn(
	"min-h-40 font-[family-name:var(--font-read)] text-[18px] leading-[1.68] text-foreground",
	"[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none [&_.ProseMirror]:[overflow-wrap:anywhere]",
	"[&_.ProseMirror_p]:my-0 [&_.ProseMirror_p+p]:mt-[0.6em]",
	"[&_.ProseMirror_h1]:mb-1 [&_.ProseMirror_h1]:mt-[1em] [&_.ProseMirror_h1]:font-ui [&_.ProseMirror_h1]:text-[24px] [&_.ProseMirror_h1]:font-semibold",
	"[&_.ProseMirror_h2]:mb-1 [&_.ProseMirror_h2]:mt-[1em] [&_.ProseMirror_h2]:font-ui [&_.ProseMirror_h2]:text-[20px] [&_.ProseMirror_h2]:font-semibold",
	"[&_.ProseMirror_h3]:mt-[0.9em] [&_.ProseMirror_h3]:font-ui [&_.ProseMirror_h3]:text-[17px] [&_.ProseMirror_h3]:font-semibold",
	"[&_.ProseMirror_ul]:my-[0.4em] [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:my-[0.4em] [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
	"[&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-[var(--q-line-2)] [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:text-ink-2",
	"[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-well [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:text-[0.88em]",
	"[&_.ProseMirror_a:not([data-mention])]:text-teal-2 [&_.ProseMirror_a:not([data-mention])]:underline [&_.ProseMirror_a:not([data-mention])]:underline-offset-2",
	"[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-ink-4/70 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
);

export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(props, ref) {
	const latest = useRef(props);
	latest.current = props;
	const [menu, setMenu] = useState<PasteMenu | null>(null);
	const [active, setActive] = useState(0);
	const menuRef = useRef<PasteMenu | null>(null);
	menuRef.current = menu;
	const activeRef = useRef(0);
	activeRef.current = active;
	const editorRef = useRef<Editor | null>(null);

	const pick = (choice: Choice) => {
		const editor = editorRef.current;
		const m = menuRef.current;
		setMenu(null);
		if (!editor || !m) return;
		if (choice === "mention") {
			editor
				.chain()
				.focus()
				.insertContentAt({ from: m.from, to: m.to }, [
					{ type: "linkMention", attrs: { url: m.url, title: "" } },
					{ type: "text", text: " " },
				])
				.run();
		} else if (choice === "card") {
			editor.chain().focus().deleteRange({ from: m.from, to: m.to }).run();
			latest.current.onCard(m.url);
		} else {
			editor.chain().focus().setTextSelection(m.to).run();
		}
	};
	const pickRef = useRef(pick);
	pickRef.current = pick;

	const editor = useEditor({
		immediatelyRender: false,
		autofocus: props.autoFocus ? "end" : false,
		extensions: [
			StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false } }),
			Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
			Placeholder.configure({ placeholder: () => latest.current.placeholder }),
			LinkMention,
			NoteStamp.configure({ onSeek: (sec: number) => latest.current.onSeek(sec) }),
		],
		content: props.initial,
		contentType: "markdown",
		onUpdate: ({ editor: e }) => latest.current.onChange(e.getMarkdown()),
		onBlur: () => latest.current.onBlur(),
		editorProps: {
			attributes: { "data-testid": "notes-body", "aria-label": "Note", spellcheck: "false" },
			handlePaste(view, event) {
				const url = pastedLink(event.clipboardData?.getData("text/plain") ?? "");
				const e = editorRef.current;
				if (!url || !e) return false;
				const from = view.state.selection.from;
				e.chain()
					.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] })
					.run();
				const to = from + url.length;
				const at = view.coordsAtPos(to);
				setActive(0);
				setMenu({
					url,
					from,
					to,
					left: Math.max(8, Math.min(at.left, window.innerWidth - 296)),
					top: Math.min(at.bottom + 6, window.innerHeight - 220),
				});
				return true;
			},
			handleKeyDown(_view, event) {
				if (menuRef.current) {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						const step = event.key === "ArrowDown" ? 1 : -1;
						setActive((a) => (a + step + CHOICES.length) % CHOICES.length);
						return true;
					}
					if (event.key === "Enter") {
						event.preventDefault();
						pickRef.current(CHOICES[activeRef.current]!.id);
						return true;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						pickRef.current("link");
						return true;
					}
					setMenu(null);
				}
				if (belongsToLayoutAccent(event)) return false;
				if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyT" && latest.current.hasVideo) {
					event.preventDefault();
					latest.current.onStampKey();
					return true;
				}
				return false;
			},
		},
	});
	editorRef.current = editor;

	useEffect(() => {
		if (!menu) return;
		const close = () => setMenu(null);
		const closeOutside = (e: MouseEvent) => {
			if (!(e.target instanceof Element) || !e.target.closest("[data-testid=notes-paste-menu]")) setMenu(null);
		};
		window.addEventListener("scroll", close, true);
		window.addEventListener("resize", close);
		window.addEventListener("mousedown", closeOutside);
		return () => {
			window.removeEventListener("scroll", close, true);
			window.removeEventListener("resize", close);
			window.removeEventListener("mousedown", closeOutside);
		};
	}, [menu]);

	useImperativeHandle(
		ref,
		() => ({
			insertStamp: (sec: number) => {
				if (!editor) return;
				const atLineStart =
					editor.state.selection.$from.parentOffset === 0 ||
					editor.state.selection.$from.nodeBefore?.type.name === "hardBreak";
				editor
					.chain()
					.focus()
					.insertContent([
						...(atLineStart ? [] : [{ type: "hardBreak" }]),
						{ type: "noteStamp", attrs: { sec: Math.floor(sec) } },
						{ type: "text", text: " " },
					])
					.run();
			},
			focusEnd: () => {
				editor?.chain().focus("end").run();
			},
		}),
		[editor],
	);

	return (
		<>
			<EditorContent editor={editor} className={PROSE} />
			{menu && <PasteChoices menu={menu} active={active} onPick={(c) => pick(c)} onHover={(i) => setActive(i)} />}
		</>
	);
});
