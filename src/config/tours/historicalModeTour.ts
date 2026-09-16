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
    element: () => getVisibleTourElement(TOUR_SELECTORS.mapTimebar),
    onHighlightStarted: (element, _step, { driver }) => {
      if (element) {
        return;
      }

      waitForTourElement(TOUR_SELECTORS.mapTimebar)
        .then(() => driver.refresh())
        .catch(() => driver.destroy());
    },
    popover: {
      title: t("tour.historical.step1.title"),
      description: t("tour.historical.step1.description"),
      side: "top",
      align: "center",
      showButtons: ["next", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.mapTimebarPlay),
    popover: {
      title: t("tour.historical.step2.title"),
      description: t("tour.historical.step2.description"),
      side: "top",
      align: "end",
      showButtons: ["next", "close"],
      popoverClass: "openairmap-tour-popover",
    },
  },
  {
    element: () => getVisibleTourElement(TOUR_SELECTORS.mapTimebarGoto),
    popover: {
      title: t("tour.historical.step3.title"),
      description: t("tour.historical.step3.description"),
      side: "top",
      align: "end",
      showButtons: ["close"],
      doneBtnText: t("tour.common.done"),
      popoverClass: "openairmap-tour-popover",
    },
  },
];
