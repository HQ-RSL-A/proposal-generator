import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
      if (account?.provider === "google") {
        return (
          (profile as Record<string, unknown>)?.email_verified === true &&
          profile?.email?.endsWith("@rsla.io") === true
        );
      }
      return false;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
