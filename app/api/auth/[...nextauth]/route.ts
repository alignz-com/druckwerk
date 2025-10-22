// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const allowedDomains =
  (process.env.ALLOWED_DOMAINS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

const allowedTenants =
  (process.env.ALLOWED_TENANTS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

const handler = NextAuth({
  providers: [
    AzureADProvider({
      // Multi-Tenant Login
      tenantId: "common",
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: { params: { prompt: "login" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = (user?.email ?? "").toLowerCase();
      const domain = email.split("@")[1] ?? "";
      const tenantId =
        (profile as any)?.tid?.toLowerCase?.() ||
        (account as any)?.tenantId?.toLowerCase?.();

      // 1) Domain-Whitelist
      if (allowedDomains.length && !allowedDomains.includes(domain)) return false;

      // 2) Optional: Tenant-Whitelist
      if (allowedTenants.length && (!tenantId || !allowedTenants.includes(tenantId)))
        return false;

      return true;
    },

    async session({ session, token }) {
      // TS-safe: nur setzen, wenn vorhanden
      if (session?.user) {
        if (token?.email) session.user.email = String(token.email);
        if (token?.name)  session.user.name  = String(token.name);
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };