import type { DriveStep } from "driver.js";
import type { TFunction } from "i18next";
import { TOUR_SELECTORS } from "./types";
import { getVisibleTourElement, revealRailItem } from "./tourDom";

export const buildAppOverviewTourSteps = (t: TFunction): DriveStep[] => [
  {
    popover: {
      title: t("tour.global.welcome.title"),
      description: t("tour.global.welcome.description"),
      showButtons: ["next", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.globalPollutant),
    onHighlightStarted: () => revealRailItem(TOUR_SELECTORS.globalPollutant),
    popover: {
      title: t("tour.global.pollutant.title"),
      description: t("tour.global.pollutant.description"),
      side: "right",
      align: "center",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.globalSources),
    onHighlightStarted: () => revealRailItem(TOUR_SELECTORS.globalSources),
    popover: {
      title: t("tour.global.sources.title"),
      description: t("tour.global.sources.description"),
      side: "right",
      align: "center",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.globalTimeStep),
    onHighlightStarted: () => revealRailItem(TOUR_SELECTORS.globalTimeStep),
    popover: {
      title: t("tour.global.timeStep.title"),
      description: t("tour.global.timeStep.description"),
      side: "right",
      align: "center",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: TOUR_SELECTORS.globalSearch,
    popover: {
      title: t("tour.global.search.title"),
      description: t("tour.global.search.description"),
      side: "left",
      align: "center",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: TOUR_SELECTORS.globalLegend,
    popover: {
      title: t("tour.global.legend.title"),
      description: t("tour.global.legend.description"),
      side: "top",
      align: "center",
      showButtons: ["previous", "close"],
      doneBtnText: t("tour.common.done"),
      popoverClass: "openairmap-tour-popover",
    },
  },
];
