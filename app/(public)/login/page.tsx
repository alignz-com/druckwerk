import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import SignInCard from "./sign-in-card";

export default async function LoginPage() {
  const session = await getServerAuthSession();

  if (session) {
    redirect("/orders/new");
  }

  return <SignInCard />;
}
