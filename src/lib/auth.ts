import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          hd: "rsla.io",
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email?.toLowerCase();
      const verified = (profile as Record<string, unknown>)?.email_verified === true;
      if (!verified || !email?.endsWith("@rsla.io")) return false;

      // Allowlist: the Google domain gets you to the door; a User row gets you in.
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.active) return false;

      await prisma.user
        .update({
          where: { email },
          data: {
            lastLoginAt: new Date(),
            avatarUrl: (profile?.picture as string | undefined) ?? user.avatarUrl,
            name: profile?.name ?? user.name,
          },
        })
        .catch(() => {});
      return true;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
