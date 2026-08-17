import type { DriveStep } from "driver.js";
import type { TFunction } from "i18next";
import { TOUR_SELECTORS } from "./types";
import { getVisibleTourElement } from "./tourDom";

const waitForTourElement = (
  selector: string,
  timeoutMs = 8000
): Promise<Element> =>
  new Promise((resolve, reject) => {
    const existing = getVisibleTourElement(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const element = getVisibleTourElement(selector);
      if (element) {
        window.clearInterval(intervalId);
        resolve(element);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(intervalId);
        reject(new Error(`Tour element not found: ${selector}`));
      }
    }, 100);
  });

export const buildHistoricalModeTourSteps = (t: TFunction): DriveStep[] => [
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.historicalToggle),
    popover: {
      title: t("tour.historical.step1.title"),
      description: t("tour.historical.step1.description"),
      side: "right",
      align: "start",
      showButtons: ["close"],
      popoverClass: "openairmap-tour-popover",
    },
    disableActiveInteraction: false,
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.historicalToggle),
    popover: {
      title: t("tour.historical.step2.title"),
      description: t("tour.historical.step2.description"),
      side: "right",
      align: "start",
      showButtons: ["close"],
      popoverClass: "openairmap-tour-popover",
    },
    disableActiveInteraction: false,
  },
  {
    element: TOUR_SELECTORS.historicalDatePanel,
    onHighlightStarted: (element, _step, { driver }) => {
      if (element) {
        return;
      }

      waitForTourElement(TOUR_SELECTORS.historicalDatePanel)
        .then(() => driver.refresh())
        .catch(() => driver.destroy());
    },
    popover: {
      title: t("tour.historical.step3.title"),
      description: t("tour.historical.step3.description"),
      side: "left",
      align: "start",
      showButtons: ["next", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: TOUR_SELECTORS.historicalLoadData,
    popover: {
      title: t("tour.historical.step4.title"),
      description: t("tour.historical.step4.description"),
      side: "top",
      align: "center",
      showButtons: ["close"],
      popoverClass: "openairmap-tour-popover",
    },
    disableActiveInteraction: false,
  },
  {
    element: TOUR_SELECTORS.historicalPlayback,
    onHighlightStarted: (element, _step, { driver }) => {
      if (element) {
        return;
      }

      waitForTourElement(TOUR_SELECTORS.historicalPlayback)
        .then(() => driver.refresh())
        .catch(() => driver.destroy());
    },
    popover: {
      title: t("tour.historical.step5.title"),
      description: t("tour.historical.step5.description"),
      side: "left",
      align: "start",
      showButtons: ["close"],
      doneBtnText: t("tour.common.done"),
      popoverClass: "openairmap-tour-popover",
    },
  },
];
