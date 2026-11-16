export interface AttachedPdf {
	path: string;
	name: string;
	pages: number;
}

export interface AttachedImage {
	path: string;
	name: string;
}

const PDF_LINE = /^My PDF "(.+)" \((\d+) pages?\): (.+)$/;
const IMAGE_LINE = /^My image "(.+)": (.+)$/;

export function attachedPdfLine(pdf: AttachedPdf): string {
	return `My PDF "${pdf.name}" (${pdf.pages} page${pdf.pages === 1 ? "" : "s"}): ${pdf.path}`;
}

export function attachedImageLine(img: AttachedImage): string {
	return `My image "${img.name}": ${img.path}`;
}

export interface DraftParts {
	pdfs: AttachedPdf[];
	images: AttachedImage[];
	rest: string;
}

export function splitAttachedPdfs(text: string): DraftParts {
	const { pdfs, images, rest } = splitDraft(text);
	return { pdfs, images, rest: rest.trim() };
}

export function splitDraft(text: string): DraftParts {
	const pdfs: AttachedPdf[] = [];
	const images: AttachedImage[] = [];
	const rest: string[] = [];
	for (const line of text.split("\n")) {
		const pdfMatch = PDF_LINE.exec(line);
		if (pdfMatch) {
			pdfs.push({ name: pdfMatch[1]!, pages: Number(pdfMatch[2]), path: pdfMatch[3]! });
			continue;
		}
		const imgMatch = IMAGE_LINE.exec(line);
		if (imgMatch) {
			images.push({ name: imgMatch[1]!, path: imgMatch[2]! });
			continue;
		}
		rest.push(line);
	}
	return { pdfs, images, rest: rest.join("\n") };
}

export function joinDraft(
	attachmentsOrPdfs: readonly AttachedPdf[] | { pdfs?: readonly AttachedPdf[]; images?: readonly AttachedImage[] },
	rest: string,
	images?: readonly AttachedImage[],
): string {
	if ("length" in attachmentsOrPdfs) {
		const pdfs = attachmentsOrPdfs;
		const imgs = images ?? [];
		if (pdfs.length === 0 && imgs.length === 0) return rest;
		return [...pdfs.map(attachedPdfLine), ...imgs.map(attachedImageLine), rest].join("\n");
	}
	const pdfs = attachmentsOrPdfs.pdfs ?? [];
	const imgs = attachmentsOrPdfs.images ?? [];
	if (pdfs.length === 0 && imgs.length === 0) return rest;
	return [...pdfs.map(attachedPdfLine), ...imgs.map(attachedImageLine), rest].join("\n");
}
