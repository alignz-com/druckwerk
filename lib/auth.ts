import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

import { prisma } from "./prisma";

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
      authorization: { params: { prompt: "login" } },
    }),
    CredentialsProvider({
      id: "email",
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

      console.log("[auth] login attempt", { email, domain, tenantId });

      const domainOk =
        allowedDomains.length === 0 || allowedDomains.includes(domain);

      const tenantOk =
        allowedTenants.length === 0 || (tenantId && allowedTenants.includes(tenantId));

      return domainOk || tenantOk;
    },

    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as any).role;
        token.brandId = (user as any).brandId ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : undefined;
        if (token?.email) session.user.email = String(token.email);
        if (token?.name) session.user.name = String(token.name);
        session.user.role = (token?.role as UserRole | undefined) ?? UserRole.USER;
        session.user.brandId = token?.brandId ? String(token.brandId) : undefined;
      }
      return session;
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
