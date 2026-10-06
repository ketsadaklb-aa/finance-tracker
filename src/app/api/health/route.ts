import { NextResponse } from "next/server";

// Liveness probe for Railway's deploy healthcheck. Public (see PUBLIC_PATHS in
// middleware) and DB-free, so it answers 200 as soon as the server is up —
// unlike "/", which redirects anonymous requests to /login.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
