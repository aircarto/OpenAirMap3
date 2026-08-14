import React from "react";
import { useTranslation } from "react-i18next";
import { useMapControls } from "../../../contexts/mapControlsContext";

/**
 * Rail de contrôles de la carte.
 *
 * Ancré en `absolute` DANS la colonne carte (le `div.flex-1.relative`
 * d'AirQualityMap) et non en `fixed` : les panneaux latéraux sont des frères
 * flex qui poussent cette colonne, donc le rail glisse avec elle au lieu de
 * rester par-dessus.
 *
 * À ce stade il ne contient que le bloc de marque ; les sections de contrôles
 * arrivent aux lots suivants. Monté uniquement si featureFlags.useControlRail.
 */
export const MapControlRail: React.FC = () => {
  const { brand } = useMapControls();
  const { t } = useTranslation();

  return (
    <nav
      data-testid="map-control-rail"
      aria-label={t("controls.openControls")}
      className="glass-1 absolute left-3 top-3 z-rail flex max-h-[calc(100%-1.5rem)] w-[max(3.75rem,60px)] flex-col items-center gap-1 p-1.5"
      style={{ borderRadius: "var(--r-xl)" }}
    >
      <img
        src={brand.markSquare ?? brand.favicon}
        alt=""
        aria-hidden="true"
        className="h-11 w-11 shrink-0 rounded-[var(--r-md)] object-contain"
      />
    </nav>
  );
};

export default MapControlRail;
