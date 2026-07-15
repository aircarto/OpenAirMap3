import React from "react";
import { useTranslation } from "react-i18next";
import { promotedSensors } from "../../config/promotedSensors";
import { useSensorPromoDismiss } from "../../hooks/useSensorPromoDismiss";

interface SensorPromoCardProps {
  shopUrl: string;
  hidden?: boolean;
}

const SensorPromoCard: React.FC<SensorPromoCardProps> = ({
  shopUrl,
  hidden = false,
}) => {
  const { t } = useTranslation();
  const { isDismissed, dismiss } = useSensorPromoDismiss();

  if (hidden || isDismissed || promotedSensors.length === 0) {
    return null;
  }

  const isSingleSensor = promotedSensors.length === 1;

  return (
    <aside
      role="complementary"
      aria-label={t("promo.sensor.title")}
      className="absolute z-[1500] bottom-20 left-4 right-4 max-w-sm mx-auto md:mx-0 md:bottom-auto md:left-auto md:top-14 md:right-4 md:max-w-[17rem] overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/30"
        aria-label={t("promo.sensor.close")}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div
        className={`relative bg-gradient-to-br from-[#4271B3]/10 via-slate-50 to-white ${
          isSingleSensor ? "px-4 pb-3 pt-4" : "p-3"
        }`}
      >
        <div
          className={
            isSingleSensor
              ? "flex items-center justify-center"
              : "flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none"
          }
        >
          {promotedSensors.map((sensor) => (
            <figure
              key={sensor.id}
              className={
                isSingleSensor
                  ? "relative m-0 w-full"
                  : "relative m-0 min-w-[5.5rem] flex-shrink-0 snap-center"
              }
            >
              <div
                className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 ${
                  isSingleSensor ? "aspect-[4/3]" : "aspect-square"
                }`}
              >
                <img
                  src={sensor.imageUrl}
                  alt={t(sensor.altKey)}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              </div>
              <figcaption className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#4271B3]">
                {t(sensor.nameKey)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <h2 className="text-sm font-bold leading-tight text-slate-900">
          {t("promo.sensor.title")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {t("promo.sensor.description")}
        </p>
        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#4271B3] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#325A96] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#4271B3]/40 focus:ring-offset-1"
          aria-label={t("promo.sensor.cta")}
        >
          {t("promo.sensor.cta")}
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </aside>
  );
};

export default SensorPromoCard;
