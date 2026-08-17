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
  const isDualSensor = promotedSensors.length === 2;

  const sensorsLayoutClass = isSingleSensor
    ? "flex items-center justify-center"
    : isDualSensor
      ? "grid grid-cols-2 gap-1.5"
      : "flex gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-none";

  const getFigureClass = () => {
    if (isSingleSensor) return "relative m-0 w-full";
    if (isDualSensor) return "relative m-0 min-w-0 w-full";
    return "relative m-0 w-[4.5rem] flex-shrink-0 snap-center";
  };

  const getImageWrapperClass = () => {
    const base =
      "relative w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70";
    if (isSingleSensor) return `${base} aspect-[4/3]`;
    return `${base} aspect-[4/3] md:aspect-square`;
  };

  return (
    <aside
      aria-label={t("promo.sensor.title")}
      // Persistante et non transitoire : le haut-droite est réservé à la recherche
      // et aux notices, une promotion fermable va en bas-droite où elle ne
      // concurrence rien.
      className="glass-3 pointer-events-auto relative w-[11rem] shrink-0 overflow-hidden rounded-[var(--r-lg)] md:w-[13.5rem]"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-0.5 top-0.5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--fg-muted)] transition-colors hover:bg-black/5 hover:text-[color:var(--fg)] focus:outline-none focus:ring-2 focus:ring-[#4271B3]/30"
        aria-label={t("promo.sensor.close")}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div
        className={`relative bg-gradient-to-br from-[#4271B3]/8 via-slate-50 to-white ${
          isSingleSensor ? "px-3 pb-2 pt-3" : "p-1.5 md:p-2"
        }`}
      >
        <div className={sensorsLayoutClass}>
          {promotedSensors.map((sensor) => (
            <figure key={sensor.id} className={getFigureClass()}>
              <div className={getImageWrapperClass()}>
                <img
                  src={sensor.imageUrl}
                  alt={t(sensor.altKey)}
                  className="absolute inset-0 m-auto h-full w-full max-h-full max-w-full object-contain p-1"
                  loading="lazy"
                />
              </div>
              <figcaption className="mt-0.5 md:mt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-[#4271B3]">
                {t(sensor.nameKey)}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 pb-2 pt-1.5 md:pb-3 md:pt-2">
        <h2 className="text-xs font-bold leading-tight text-slate-900">
          {t("promo.sensor.title")}
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
          {t("promo.sensor.description")}
        </p>
        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 md:mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#4271B3] px-2.5 py-1 md:py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#325A96] focus:outline-none focus:ring-2 focus:ring-[#4271B3]/40 focus:ring-offset-1"
          aria-label={t("promo.sensor.cta")}
        >
          {t("promo.sensor.cta")}
          <svg
            className="h-3.5 w-3.5"
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
