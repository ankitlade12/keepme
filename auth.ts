import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? (process.env.KEEPME_ALLOW_EPHEMERAL !== "false" ? "keepme-local-auth-secret-never-use-in-production" : undefined),
  trustHost: process.env.NODE_ENV !== "production" || process.env.KEEPME_ALLOW_EPHEMERAL !== "false" || Boolean(process.env.VERCEL) || process.env.AUTH_TRUST_HOST === "true",
  providers: process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })]
    : [],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/signin" },
  callbacks: {
    authorized: async ({ auth: session }) => Boolean(session?.user?.email),
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-keepme.auth" : "keepme.auth",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
});
