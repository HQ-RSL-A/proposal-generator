import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check for the session cookie (NextAuth v5 uses __Secure- prefix in prod, authjs.session-token in dev)
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
