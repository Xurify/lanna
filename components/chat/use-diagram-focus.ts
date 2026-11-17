import { useState } from "react";

interface FigureFocus {
	svg: string;
	inverted: boolean;
}

export function useDiagramFocus() {
	const [mermaidFocus, setMermaidFocus] = useState<string | null>(null);
	const [figureFocus, setFigureFocus] = useState<FigureFocus | null>(null);

	return {
		mermaidFocus,
		figureFocus,
		mermaidOpen: mermaidFocus !== null || figureFocus !== null,
		openMermaid: setMermaidFocus,
		openFigure: (svg: string, inverted: boolean) => setFigureFocus({ svg, inverted }),
		closeMermaid: () => setMermaidFocus(null),
		closeFigure: () => setFigureFocus(null),
	};
}
