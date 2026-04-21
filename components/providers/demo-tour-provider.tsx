"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

import { SELECTOR_TOUR_STEPS, BC_TOUR_STEPS, PDF_TOUR_STEPS, resolveSteps } from "@/lib/tour/steps"
import { useTranslations } from "@/components/providers/locale-provider"

type Props = {
  isDemo: boolean
}

function isElementVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null || el.offsetWidth > 0
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

    // Determine which tour to run based on path + param
    const isSelectorTour = tourParam === "bc" && pathname === "/orders/new"
      && document.querySelector("[data-tour='selector-bc']") !== null
    const isBcFormDirect = tourParam === "bc" && pathname === "/orders/new"
      && !isSelectorTour
    const isBcCardTour = tourParam === "bc" && pathname === "/orders/new/card"
    const isPdfTour = tourParam === "pdf" && pathname === "/orders/new/pdf"

    if (!isSelectorTour && !isBcFormDirect && !isBcCardTour && !isPdfTour) return

    let steps
    if (isSelectorTour) {
      steps = SELECTOR_TOUR_STEPS
    } else if (isBcFormDirect || isBcCardTour) {
      steps = BC_TOUR_STEPS
    } else {
      steps = PDF_TOUR_STEPS
    }

    const resolvedSteps = resolveSteps(steps, t)

    // Wait for elements to render
    const timeout = setTimeout(() => {
      // Filter steps to only those whose elements are visible in the DOM
      const availableSteps = resolvedSteps.filter((step) => {
        if (!step.element) return true
        const selector = typeof step.element === "string" ? step.element : null
        if (!selector) return true
        const el = document.querySelector(selector) as HTMLElement | null
        if (!el) return false
        return isElementVisible(el)
      })

      if (availableSteps.length === 0) return

      tourStarted.current = true

      const driverObj = driver({
        showProgress: false,
        animate: true,
        allowClose: true,
        showButtons: ["next", "previous", "close"],
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

          // After BC form tour on /orders/new/card, redirect to PDF tour
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
