import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const allowedDomains = (process.env.ALLOWED_DOMAINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const allowedTenants = (process.env.ALLOWED_TENANTS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const handler = NextAuth({
  providers: [
    AzureADProvider({
      // "common" = Multi-Tenant (alle Azure-AD-Tenants erlaubt)
      tenantId: "common",
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: {
        params: { prompt: "login" }, // erzwingt Kontenauswahl
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = (user.email ?? "").toLowerCase();
      const domain = email.split("@")[1] ?? "";
      const tenantId =
        (profile as any)?.tid?.toLowerCase?.() ||
        (account as any)?.tenantId?.toLowerCase?.();

      // 1️⃣ Domain-Whitelist prüfen
      if (allowedDomains.length && !allowedDomains.includes(domain)) return false;

      // 2️⃣ Optional Tenant-Whitelist prüfen
      if (allowedTenants.length && (!tenantId || !allowedTenants.includes(tenantId)))
        return false;

      return true;
    },
    async session({ session, token }) {
      if (token?.email) session.user.email = token.email as string;
      return session;
    },
  },
});

export { handler as GET, handler as POST };