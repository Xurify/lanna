import { useEffect, useState } from "react";

export function usePageTitleInView() {
	const [pageTitle, setPageTitle] = useState<HTMLHeadingElement | null>(null);
	const [pageTitleInView, setPageTitleInView] = useState(false);

	useEffect(() => {
		if (!pageTitle) {
			setPageTitleInView(false);
			return;
		}
		const observer = new IntersectionObserver(([entry]) => setPageTitleInView(entry?.isIntersecting ?? false));
		observer.observe(pageTitle);
		return () => observer.disconnect();
	}, [pageTitle]);

	return { pageTitleInView, setPageTitle };
}
