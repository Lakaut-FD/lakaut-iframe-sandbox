import { withAuth } from "next-auth/middleware";
import { ALLOWED_DOMAINS } from "@/lib/auth";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      const email = token?.email as string | undefined;
      if (!email) return false;
      const domain = email.split("@")[1];
      return ALLOWED_DOMAINS.includes(domain);
    },
  },
  pages: {
    signIn: "/api/auth/signin",
    error: "/denied",
  },
});

export const config = {
  matcher: ["/((?!api/auth|denied|_next/static|_next/image|favicon.ico).*)"],
};
