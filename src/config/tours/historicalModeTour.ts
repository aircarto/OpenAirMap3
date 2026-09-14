import type { DriveStep } from "driver.js";
import type { TFunction } from "i18next";
import { TOUR_SELECTORS } from "./types";
import { getVisibleTourElement } from "./tourDom";

export const buildHistoricalModeTourSteps = (t: TFunction): DriveStep[] => [
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.historicalToggle),
    popover: {
      title: t("tour.historical.step1.title"),
      description: t("tour.historical.step1.description"),
      side: "top",
      align: "center",
      showButtons: ["next", "close"],
      popoverClass: "openairmap-tour-popover",
    },
    disableActiveInteraction: false,
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.historicalDatePanel),
    popover: {
      title: t("tour.historical.step2.title"),
      description: t("tour.historical.step2.description"),
      side: "top",
      align: "end",
      showButtons: ["close"],
      doneBtnText: t("tour.common.done"),
      popoverClass: "openairmap-tour-popover",
    },
    disableActiveInteraction: false,
  },
];
