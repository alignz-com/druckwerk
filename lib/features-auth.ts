import { NextRequest } from "next/server";
import { getServerAuthSession } from "@/lib/auth";

/**
 * Authorize access to features API.
 * Accepts either:
 * 1. A valid admin session (browser cookie)
 * 2. A Bearer token matching FEATURES_API_TOKEN (for CLI / Claude access)
 *
 * Returns { authorized: true, author } or { authorized: false }.
 */
export async function authorizeFeatures(
  req: NextRequest,
): Promise<{ authorized: true; author: string } | { authorized: false }> {
  // Check bearer token first (fast path for API access)
  const authHeader = req.headers.get("authorization");
  const token = process.env.FEATURES_API_TOKEN;
  if (token && authHeader === `Bearer ${token}`) {
    return { authorized: true, author: "Claude" };
  }

  // Fall back to session auth
  const session = await getServerAuthSession();
  if (session?.user.role === "ADMIN") {
    return {
      authorized: true,
      author: session.user.name || session.user.email || "Admin",
    };
  }

  return { authorized: false };
}
