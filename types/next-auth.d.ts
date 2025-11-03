import type { DefaultSession } from "next-auth";

import type { AppUserRole } from "./auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role: AppUserRole;
      brandId?: string | null;
      locale?: string;
    };
  }

  interface User {
    role: AppUserRole;
    brandId?: string | null;
    locale?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: AppUserRole;
    brandId?: string | null;
    locale?: string;
  }
}
