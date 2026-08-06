import type { DriveStep } from "driver.js";
import type { TFunction } from "i18next";
import { TOUR_SELECTORS } from "./types";

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
    element: TOUR_SELECTORS.globalPollutant,
    popover: {
      title: t("tour.global.pollutant.title"),
      description: t("tour.global.pollutant.description"),
      side: "bottom",
      align: "start",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: TOUR_SELECTORS.globalSources,
    popover: {
      title: t("tour.global.sources.title"),
      description: t("tour.global.sources.description"),
      side: "bottom",
      align: "start",
      showButtons: ["next", "previous", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: TOUR_SELECTORS.globalTimeStep,
    popover: {
      title: t("tour.global.timeStep.title"),
      description: t("tour.global.timeStep.description"),
      side: "bottom",
      align: "start",
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
      align: "start",
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
