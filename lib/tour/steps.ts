import type { DriveStep } from "driver.js"

type TourStep = Omit<DriveStep, "popover"> & {
  popover: {
    titleKey: string
    descriptionKey: string
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
  }
}

export const SELECTOR_TOUR_STEPS: TourStep[] = [
  {
    popover: {
      titleKey: "tour.selector.welcome.title",
      descriptionKey: "tour.selector.welcome.description",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='selector-bc']",
    popover: {
      titleKey: "tour.selector.bc.title",
      descriptionKey: "tour.selector.bc.description",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='selector-pdf']",
    popover: {
      titleKey: "tour.selector.pdf.title",
      descriptionKey: "tour.selector.pdf.description",
      side: "bottom",
      align: "center",
    },
  },
]

export const BC_TOUR_STEPS: TourStep[] = [
  {
    element: "[data-tour='bc-preview']",
    popover: {
      titleKey: "tour.bc.preview.title",
      descriptionKey: "tour.bc.preview.description",
      side: "left",
      align: "center",
    },
  },
  {
    element: "[data-tour='bc-template']",
    popover: {
      titleKey: "tour.bc.template.title",
      descriptionKey: "tour.bc.template.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-quantity']",
    popover: {
      titleKey: "tour.bc.quantity.title",
      descriptionKey: "tour.bc.quantity.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-delivery']",
    popover: {
      titleKey: "tour.bc.delivery.title",
      descriptionKey: "tour.bc.delivery.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-name']",
    popover: {
      titleKey: "tour.bc.name.title",
      descriptionKey: "tour.bc.name.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-personal']",
    popover: {
      titleKey: "tour.bc.personal.title",
      descriptionKey: "tour.bc.personal.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-address']",
    popover: {
      titleKey: "tour.bc.address.title",
      descriptionKey: "tour.bc.address.description",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='bc-submit']",
    popover: {
      titleKey: "tour.bc.submit.title",
      descriptionKey: "tour.bc.submit.description",
      side: "top",
      align: "center",
    },
  },
]

export const PDF_TOUR_STEPS: TourStep[] = [
  {
    element: "[data-tour='pdf-order-info']",
    popover: {
      titleKey: "tour.pdf.orderInfo.title",
      descriptionKey: "tour.pdf.orderInfo.description",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='pdf-dropzone']",
    popover: {
      titleKey: "tour.pdf.dropzone.title",
      descriptionKey: "tour.pdf.dropzone.description",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='pdf-submit']",
    popover: {
      titleKey: "tour.pdf.submit.title",
      descriptionKey: "tour.pdf.submit.description",
      side: "top",
      align: "center",
    },
  },
]

/** Resolve i18n keys to actual text using the translation function */
export function resolveSteps(
  steps: TourStep[],
  t: (key: string) => string,
): DriveStep[] {
  return steps.map((step) => ({
    ...step,
    popover: {
      title: t(step.popover.titleKey),
      description: t(step.popover.descriptionKey),
      side: step.popover.side,
      align: step.popover.align,
    },
  }))
}
