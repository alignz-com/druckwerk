// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const allowedDomains = (process.env.ALLOWED_DOMAINS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const allowedTenants = (process.env.ALLOWED_TENANTS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const handler = NextAuth({
  providers: [
    AzureADProvider({
      tenantId: "common", // Multi-tenant
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: { params: { prompt: "login" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // robust E-Mail/UPN-Extraction
      const raw =
        (user?.email ??
          (profile as any)?.email ??
          (profile as any)?.preferred_username ??
          (profile as any)?.upn ??
          "") as string;

      const email = raw.toLowerCase();
      const domain = email.includes("@") ? email.split("@")[1] : "";
      const tenantId =
        (profile as any)?.tid?.toLowerCase?.() ||
        (account as any)?.tenantId?.toLowerCase?.() ||
        "";

      // Debug-Ausgabe in Logs (hilft beim nächsten Schritt)
      console.log("[auth] login attempt", { email, domain, tenantId });

      const domainOk =
        allowedDomains.length === 0 || allowedDomains.includes(domain);

      const tenantOk =
        allowedTenants.length === 0 || (tenantId && allowedTenants.includes(tenantId));

      // **OR-Logik**: Tenant passt ODER Domain passt
      return domainOk || tenantOk;
    },

    async session({ session, token }) {
      if (session?.user) {
        if (token?.email) session.user.email = String(token.email);
        if (token?.name) session.user.name = String(token.name);
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };