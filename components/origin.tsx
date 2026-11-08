"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SESSION_ROUTES = ["/lesson", "/listen", "/speak", "/watch", "/speed"];

function isSessionRoute(pathname: string): boolean {
	return SESSION_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

let page: string | undefined;

export function readOrigin(): string {
	return page ?? "/";
}

export function OriginStamp() {
	const pathname = usePathname();
	useEffect(() => {
		if (!isSessionRoute(pathname)) page = pathname;
	}, [pathname]);
	return null;
}
