import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role: UserRole;
      brandId?: string | null;
    };
  }

  interface User {
    role: UserRole;
    brandId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
    brandId?: string | null;
  }
}
