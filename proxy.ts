import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

const PROTECTED_ROUTES: { path: string; permission?: string }[] = [
  { path: "/users", permission: PERMISSIONS.USER_VIEW },
  { path: "/claims", permission: PERMISSIONS.CLAIM_VIEW },
  { path: "/assistant", permission: PERMISSIONS.ASSISTANT_USE },
  { path: "/dashboard", permission: PERMISSIONS.DASHBOARD_VIEW },
  { path: "/accident-map", permission: PERMISSIONS.MAP_VIEW },
  { path: "/settings", permission: PERMISSIONS.SETTINGS_MANAGE },
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matched = PROTECTED_ROUTES.find((route) => pathname.startsWith(route.path));
  if (!matched) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const session = verifyAccessToken(token);
    if (matched.permission && !session.permissions.includes(matched.permission)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/users/:path*",
    "/claims/:path*",
    "/assistant/:path*",
    "/dashboard/:path*",
    "/accident-map/:path*",
    "/settings/:path*",
  ],
};
