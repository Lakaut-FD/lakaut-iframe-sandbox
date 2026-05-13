import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const ALLOWED_DOMAINS = ["lakaut.com.ar", "lakaut.com"];

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      return isAllowedEmail(profile?.email);
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: { error: "/denied" },
};

export { isAllowedEmail };
