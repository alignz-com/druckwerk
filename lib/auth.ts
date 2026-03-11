import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import type { AppUserRole } from "@/types/auth";
import { prisma } from "./prisma";
import { ensureBrandAssignmentForUser } from "./brand-auto-assign";

const allowedDomains = (process.env.ALLOWED_DOMAINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const allowedTenants = (process.env.ALLOWED_TENANTS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      tenantId: "common",
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "login",
          scope: "openid profile email offline_access User.Read",
        },
      },
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.hashedPassword) {
          return null;
        }

        const passwordOk = await bcrypt.compare(password, user.hashedPassword);
        if (!passwordOk) {
          return null;
        }

        return user;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) return false;

      if (account.provider === "credentials") {
        return Boolean(user);
      }

      const rawEmail =
        (user?.email ??
          (profile as any)?.email ??
          (profile as any)?.preferred_username ??
          (profile as any)?.upn ??
          "") as string;

      const email = rawEmail.toLowerCase();
      const domain = email.includes("@") ? email.split("@")[1] : "";
      const tenantId =
        (profile as any)?.tid?.toLowerCase?.() ||
        (account as any)?.tenantId?.toLowerCase?.() ||
        "";

      console.log("[auth] login attempt", { email, domain, tenantId });

      const domainOk =
        allowedDomains.length === 0 || allowedDomains.includes(domain);

      const tenantOk =
        allowedTenants.length === 0 || (tenantId && allowedTenants.includes(tenantId));

      const allowed = domainOk || tenantOk;

      if (!allowed) {
        return false;
      }

      if (user?.id) {
        const assignedBrandId = await ensureBrandAssignmentForUser({
          userId: user.id,
          domain,
          email,
          currentBrandId: (user as any).brandId ?? null,
        });
        if (assignedBrandId) {
          (user as any).brandId = assignedBrandId;
        }
      }

      if (account.provider === "azure-ad" && account.access_token && user?.id) {
        try {
          const graphRes = await fetch(
            "https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,surname,jobTitle,department,mobilePhone,businessPhones,mail,userPrincipalName,officeLocation,webSite",
            {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
              },
            },
          );

          if (graphRes.ok) {
            const graphProfile = (await graphRes.json()) as Record<string, any>;
            const businessPhones = Array.isArray(graphProfile?.businessPhones)
              ? graphProfile.businessPhones.filter(Boolean)
              : [];

            const updateData: Record<string, any> = {
              jobTitle: graphProfile?.jobTitle ?? null,
              department: graphProfile?.department ?? null,
              mobilePhone: graphProfile?.mobilePhone ?? null,
              businessPhone: businessPhones[0] ?? null,
            };

            if (graphProfile?.displayName) {
              updateData.name = graphProfile.displayName;
            }

            const normalizedEmail = graphProfile?.mail || graphProfile?.userPrincipalName;
            if (normalizedEmail) {
              const normalized = normalizedEmail.toLowerCase();
              if (normalized !== user.email?.toLowerCase()) {
                updateData.email = normalized;
              }
              updateData.url = buildWebsiteFromEmail(normalized);
            }

            const graphWebsite = (graphProfile?.webSite ?? graphProfile?.website)?.toString?.().trim();
            if (graphWebsite) {
              updateData.url = graphWebsite;
            }

            if (!updateData.url) {
              updateData.url = buildWebsiteFromEmail(email);
            }

            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });

            if (updateData.name) {
              user.name = updateData.name;
            }
            if (updateData.email) {
              user.email = updateData.email;
            }
            (user as any).jobTitle = updateData.jobTitle;
            (user as any).department = updateData.department;
            (user as any).mobilePhone = updateData.mobilePhone;
            (user as any).businessPhone = updateData.businessPhone;
            (user as any).url = updateData.url ?? (user as any).url ?? buildWebsiteFromEmail(email);
          } else {
            console.error("[auth] graph profile request failed", graphRes.status);
          }
        } catch (error) {
          console.error("[auth] graph profile fetch error", error);
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.role = ((user as any).role ?? "USER") as AppUserRole;
        token.brandId = (user as any).brandId ?? null;
        token.locale = (user as any).locale ?? "en";
        token.jobTitle = (user as any).jobTitle ?? null;
        token.department = (user as any).department ?? null;
        token.mobilePhone = (user as any).mobilePhone ?? null;
        token.businessPhone = (user as any).businessPhone ?? null;
        const baseEmail = (user as any).email ?? undefined;
        token.url = (user as any).url ?? buildWebsiteFromEmail(baseEmail ? String(baseEmail) : undefined);
      } else if (trigger === "update" && session?.locale) {
        token.locale = session.locale as string;
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : undefined;
        if (token?.email) session.user.email = String(token.email);
        if (token?.name) session.user.name = String(token.name);
        const tokenRole = (token?.role as AppUserRole | undefined) ?? "USER";
        session.user.role = tokenRole;
        session.user.brandId = token?.brandId ? String(token.brandId) : undefined;
        session.user.locale = typeof token.locale === "string" ? token.locale : "en";
        (session as any).locale = session.user.locale;
        session.user.jobTitle = token?.jobTitle ? String(token.jobTitle) : null;
        session.user.department = token?.department ? String(token.department) : null;
        session.user.mobilePhone = token?.mobilePhone ? String(token.mobilePhone) : null;
        session.user.businessPhone = token?.businessPhone ? String(token.businessPhone) : null;
        session.user.url = token?.url ? String(token.url) : session.user.url ?? buildWebsiteFromEmail(session.user.email ?? null);
      }
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);


function buildWebsiteFromEmail(email: string | null | undefined) {
  if (!email) return null;
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return null;
  let domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain) return null;
  if (domain.endsWith(".")) domain = domain.slice(0, -1);
  if (!domain) return null;
  if (domain.startsWith("www.")) domain = domain.slice(4);
  return domain ? `www.${domain}` : null;
}
