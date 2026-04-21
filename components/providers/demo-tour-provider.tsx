"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

import { BC_TOUR_STEPS, PDF_TOUR_STEPS, resolveSteps } from "@/lib/tour/steps"
import { useTranslations } from "@/components/providers/locale-provider"

type Props = {
  isDemo: boolean
}

export function DemoTourProvider({ isDemo }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const tourStarted = useRef(false)

  const tourParam = searchParams.get("tour")

  useEffect(() => {
    if (!isDemo || !tourParam || tourStarted.current) return

    const isBcTour = tourParam === "bc" && pathname === "/orders/new"
    const isBcCardTour = tourParam === "bc" && pathname === "/orders/new/card"
    const isPdfTour = tourParam === "pdf" && pathname === "/orders/new/pdf"

    if (!isBcTour && !isBcCardTour && !isPdfTour) return

    const steps = (isBcTour || isBcCardTour) ? BC_TOUR_STEPS : PDF_TOUR_STEPS
    const resolvedSteps = resolveSteps(steps, t)

    // Wait for elements to render
    const timeout = setTimeout(() => {
      // Filter steps to only those whose elements exist in the DOM
      const availableSteps = resolvedSteps.filter((step) => {
        if (!step.element) return true
        const selector = typeof step.element === "string" ? step.element : null
        return selector ? document.querySelector(selector) !== null : true
      })

      if (availableSteps.length === 0) return

      tourStarted.current = true

      const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.6)",
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "demo-tour-popover",
        nextBtnText: t("tour.next"),
        prevBtnText: t("tour.prev"),
        doneBtnText: t("tour.done"),
        steps: availableSteps,
        onDestroyStarted: () => {
          driverObj.destroy()

          // Remove tour param from URL without navigation
          const url = new URL(window.location.href)
          url.searchParams.delete("tour")
          window.history.replaceState({}, "", url.toString())

          // After BC tour on /orders/new/card (came from selector = user has both types),
          // redirect to PDF tour. If on /orders/new directly, user only has BC access.
          if (isBcCardTour) {
            setTimeout(() => {
              router.push("/orders/new/pdf?tour=pdf")
            }, 300)
          }
        },
      })

      driverObj.drive()
    }, 800)

    return () => clearTimeout(timeout)
  }, [isDemo, tourParam, pathname, t, router])

  // Reset ref when tour param changes
  useEffect(() => {
    if (!tourParam) {
      tourStarted.current = false
    }
  }, [tourParam])

  return null
}
