import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  fireMaskInfo,
  getHotspotRadius,
} from '../../services/EffisLayerService';

/**
 * Légendes des couches feux.
 *
 * Rendues localement et non via GetLegendGraphic : depuis que le rayon dépend de la
 * puissance radiative et l'opacité de la confiance, l'image servie par EFFIS ne décrit
 * plus ce que la carte affiche. Les rayons ci-dessous sont calculés par la même
 * fonction que les marqueurs, donc la légende ne peut pas dériver du rendu.
 */

/** Paliers de puissance radiative choisis pour couvrir l'étendue observée (0,2 à 2764 MW) */
const FRP_STEPS = [1, 10, 100, 1000];

interface SwatchProps {
  radius: number;
  fill: string;
  stroke: string;
  fillOpacity: number;
}

const CircleSwatch: React.FC<SwatchProps> = ({
  radius,
  fill,
  stroke,
  fillOpacity,
}) => {
  const size = 30;
  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={1}
      />
    </svg>
  );
};

export const EffisHotspotsLegend: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="px-1.5 py-1 space-y-2 text-[11px] text-gray-700">
      <div>
        <p className="font-medium text-gray-600 mb-1">
          {t('baseLayer.fireLegendFreshness')}
        </p>
        <div className="flex items-center gap-2">
          <CircleSwatch
            radius={6}
            fill="#ef4444"
            stroke="#991b1b"
            fillOpacity={0.8}
          />
          <span>{t('baseLayer.fireLegendLast24h')}</span>
        </div>
        <div className="flex items-center gap-2">
          <CircleSwatch
            radius={6}
            fill="#f97316"
            stroke="#c2410c"
            fillOpacity={0.8}
          />
          <span>{t('baseLayer.fireLegendOlder')}</span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-1.5">
        <p className="font-medium text-gray-600 mb-1">
          {t('baseLayer.fireLegendPower')}
        </p>
        <div className="flex items-end gap-1">
          {FRP_STEPS.map((frp) => (
            <div key={frp} className="flex flex-col items-center">
              <CircleSwatch
                radius={getHotspotRadius(String(frp))}
                fill="#f97316"
                stroke="#c2410c"
                fillOpacity={0.8}
              />
              <span className="text-[10px] text-gray-500">{frp}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {t('baseLayer.fireLegendPowerUnit')}
        </p>
      </div>

      <div className="border-t border-gray-200 pt-1.5">
        <p className="text-[10px] text-gray-500 leading-snug">
          {t('baseLayer.fireLegendMaskNote', {
            count: fireMaskInfo.cellCount,
            days: fireMaskInfo.thresholdDays,
          })}
        </p>
      </div>
    </div>
  );
};

export const EffisBurnedAreasLegend: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="px-1.5 py-1 space-y-1.5 text-[11px] text-gray-700">
      <div className="flex items-center gap-2">
        <svg width={30} height={20} className="shrink-0" aria-hidden>
          <rect
            x={2}
            y={2}
            width={26}
            height={16}
            fill="#ea580c"
            fillOpacity={0.35}
            stroke="#c2410c"
            strokeWidth={1.5}
          />
        </svg>
        <span>{t('baseLayer.fireLegendBurnedArea')}</span>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        {t('baseLayer.fireLegendBurnedNote')}
      </p>
    </div>
  );
};
