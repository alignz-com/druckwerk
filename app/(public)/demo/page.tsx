import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import { getServerAuthSession } from "@/lib/auth"
import { isLocale } from "@/lib/i18n/messages"
import DemoForm from "./demo-form"

export default async function DemoPage() {
  const session = await getServerAuthSession()

  if (session) {
    redirect("/orders/new?tour=bc")
  }

  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("locale")?.value
  const locale = isLocale(localeCookie) ? localeCookie : "en"

  return <DemoForm locale={locale} />
}
