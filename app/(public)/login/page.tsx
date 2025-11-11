import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import SignInCard from "./sign-in-card";

type LoginPageProps = {
  searchParams?: {
    reset?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerAuthSession();

  if (session) {
    redirect("/orders/new");
  }

  const successMessage =
    searchParams?.reset === "success" ? "Password updated successfully. Please sign in with your new password." : undefined;

  return <SignInCard successMessage={successMessage} />;
}
