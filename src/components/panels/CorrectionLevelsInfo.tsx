import React from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../../lib/utils";

interface CorrectionLevelsInfoProps {
  className?: string;
}

/**
 * Bouton « i » expliquant les corrections niveau 1 et niveau 2.
 *
 * Placé juste au-dessus du graphique et affiché uniquement quand le détail des
 * niveaux de correction est actif : l'explication apparaît là où les courbes
 * correspondantes sont visibles, sans encombrer le panneau le reste du temps.
 */
const CorrectionLevelsInfo: React.FC<CorrectionLevelsInfoProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const k = "panels.microSidePanel.correctionLevelsInfo";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t(`${k}.buttonAria`)}
          className={cn(
            "group inline-flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-xs text-gray-600",
            "hover:text-[#4271B3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3]/30",
            className
          )}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current font-serif text-[10px] font-bold italic leading-none"
          >
            i
          </span>
          <span className="underline decoration-dotted underline-offset-2">
            {t(`${k}.label`)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        aria-label={t(`${k}.title`)}
        className="w-[min(320px,calc(100vw-24px))] rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-md"
      >
        <p className="mb-2 text-sm font-semibold text-gray-900">
          {t(`${k}.title`)}
        </p>
        <dl className="space-y-2">
          <div>
            <dt className="font-medium text-gray-900">
              {t(`${k}.level1Title`)}
            </dt>
            <dd className="mt-0.5 leading-relaxed">{t(`${k}.level1Body`)}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">
              {t(`${k}.level2Title`)}
            </dt>
            <dd className="mt-0.5 leading-relaxed">{t(`${k}.level2Body`)}</dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  );
};

export default CorrectionLevelsInfo;
