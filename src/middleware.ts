import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ft_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Pages members are NOT allowed to visit (redirect to /ledger)
const MEMBER_BLOCKED_PAGES = ["/", "/accounts", "/transactions", "/contacts", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Members may only access the ledger (and API routes)
  const role = request.cookies.get("ft_role")?.value;
  if (role === "member" && !pathname.startsWith("/api/") && !pathname.startsWith("/ledger")) {
    if (MEMBER_BLOCKED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/ledger", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
