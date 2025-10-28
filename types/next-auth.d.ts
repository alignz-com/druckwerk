import type { DefaultSession } from "next-auth";

import type { AppUserRole } from "./auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role: AppUserRole;
      brandId?: string | null;
    };
  }

  interface User {
    role: AppUserRole;
    brandId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: AppUserRole;
    brandId?: string | null;
  }
}
