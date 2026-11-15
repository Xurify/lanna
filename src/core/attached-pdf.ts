export interface AttachedPdf {
	path: string;
	name: string;
	pages: number;
}

const LINE = /^My PDF "(.+)" \((\d+) pages?\): (.+)$/;

export function attachedPdfLine(pdf: AttachedPdf): string {
	return `My PDF "${pdf.name}" (${pdf.pages} page${pdf.pages === 1 ? "" : "s"}): ${pdf.path}`;
}

export function splitAttachedPdfs(text: string): { pdfs: AttachedPdf[]; rest: string } {
	const { pdfs, rest } = splitDraft(text);
	return { pdfs, rest: rest.trim() };
}

export function splitDraft(text: string): { pdfs: AttachedPdf[]; rest: string } {
	const pdfs: AttachedPdf[] = [];
	const rest: string[] = [];
	for (const line of text.split("\n")) {
		const match = LINE.exec(line);
		if (match) pdfs.push({ name: match[1]!, pages: Number(match[2]), path: match[3]! });
		else rest.push(line);
	}
	return { pdfs, rest: rest.join("\n") };
}

export function joinDraft(pdfs: readonly AttachedPdf[], rest: string): string {
	return pdfs.length === 0 ? rest : [...pdfs.map(attachedPdfLine), rest].join("\n");
}
