import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // UX-only fast-path: bounce the obvious logged-out case (no cookie) to sign-in cheaply at the
  // edge. This is a cookie-PRESENCE check, not JWT validation — a forged/expired cookie passes
  // here on purpose. Real authorization is re-validated at every data-access point against the
  // live, active User row: requireUser/requireAdmin in each admin page (RSL-26) and server action
  // (RSL-12), and getActiveApiUser in each API route (RSL-11). JWT verification stays out of the
  // Edge runtime (auth.ts pulls in Prisma, which isn't Edge-compatible), and a forged cookie is
  // rejected the moment it reaches any guarded surface (RSL-26).
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything is team-only except: the landing page (exact /), auth, public
    // signing/payment pages, their APIs, webhooks, crons, and static assets.
    // Static assets are excluded by extension, not by name: on Vercel the
    // middleware runs BEFORE public/ files are served (dev serves them first),
    // so a renamed asset that isn't excluded here 307s to sign-in in prod.
    "/((?!$|api/|sign-in|sign/|pay/|_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|svg|jpg|jpeg|ico|webp)$).*)",
  ],
};
