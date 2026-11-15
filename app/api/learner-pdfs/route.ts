import { bodyTooLarge, LEARNER_PDF_MAX_BYTES, LearnerPdfError, saveLearnerPdf } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, LEARNER_PDF_MAX_BYTES + 64 * 1024);
	if (oversized) return oversized;
	let file: File;
	try {
		const form = await req.formData();
		const entry = form.get("file");
		if (!(entry instanceof File)) return Response.json({ message: "file is required" }, { status: 400 });
		file = entry;
	} catch {
		return Response.json({ message: "bad request" }, { status: 400 });
	}
	try {
		return Response.json(await saveLearnerPdf(new Uint8Array(await file.arrayBuffer()), file.name));
	} catch (err) {
		if (err instanceof LearnerPdfError) return Response.json({ message: err.message }, { status: 400 });
		throw err;
	}
}
