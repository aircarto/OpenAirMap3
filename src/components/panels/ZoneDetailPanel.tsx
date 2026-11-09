import React from "react";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
import { useTranslation } from "react-i18next";
import {
  ZoneSelection,
  getZoneConfig,
  aerialImageUrl,
} from "../../constants/zones";
import {
  getSectorLabel,
  getEffectifLabel,
  getCategorieLabel,
} from "../../constants/companyLabels";
import { useZoneInfo } from "../map/hooks/useZoneInfo";
import { useContextThread } from "../map/hooks/useContextThread";
import CommentsThread from "../CommentsThread";
import { zoneSubjectId } from "../../constants/context";
import { featureFlags } from "../../config/featureFlags";


interface ZoneDetailPanelProps {
  isOpen: boolean;
  selection: ZoneSelection | null;
  onClose: () => void;
  onSizeChange?: (size: PanelSize) => void;
  panelSize?: PanelSize;
  onCenterMap?: (selection: ZoneSelection) => void;
}

const ZoneDetailPanel: React.FC<ZoneDetailPanelProps> = ({
  isOpen,
  selection,
  onClose,
  onSizeChange,
  panelSize = "normal",
  onCenterMap,
}) => {
  const { t } = useTranslation();
  const props = selection?.props;
  const { info, loading } = useZoneInfo(props?.wikipedia, props?.wikidata);

  // Fil de commentaires de la zone (sujet = "zone-<type>-<nom>")
  const thread = useContextThread(
    featureFlags.contextComments && props
      ? zoneSubjectId(props.kind, props.name || props.kind)
      : null
  );

  if (!isOpen || !selection || !props) {
    return null;
  }

  const config = getZoneConfig(props.kind);
  const displayName = props.name || t(`zones.kind.${props.kind}`);

  // Image : photo Wikipédia si dispo, sinon vue aérienne IGN (centrée sur la
  // zone) — ainsi chaque zone, même une usine sans photo, a un visuel.
  const aerial =
    props.lat != null && props.lon != null
      ? aerialImageUrl(props.lat, props.lon)
      : null;
  const imageUrl = info?.photoUrl || aerial;
  const isWikiPhoto = Boolean(info?.photoUrl);

  const sectorLabel = getSectorLabel(props.nafSection);
  const effectifLabel = getEffectifLabel(props.effectif);
  const categorieLabel = getCategorieLabel(props.categorie);
  const hasCompanyProfile =
    props.kind === "seveso" &&
    (props.naf ||
      sectorLabel ||
      props.since ||
      effectifLabel ||
      categorieLabel);

  const renderInfoLine = (label: string, value?: string | null) => {
    if (!value) return null;
    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 text-sm text-gray-700">
        <span className="font-medium text-gray-900 sm:w-40">{label}</span>
        <span className="flex-1">{value}</span>
      </div>
    );
  };

  return (
    <SidePanelShell
      isOpen={isOpen}
      panelSize={panelSize ?? "normal"}
      onSizeChange={(size) => onSizeChange?.(size)}
      onHidden={onClose}
      onClose={onClose}
      closeLabel={t("panels.closePanel")}
      width="compact"
      ariaLabel={displayName}
      title={
        <>{displayName}</>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-white"
            style={{ backgroundColor: config.color }}
          >
            {t(`zones.kind.${props.kind}`)}
          </span>
          {props.commune && <span>{props.commune}</span>}
        </span>
      }
    >
        {/* Image : photo Wikipédia si dispo, sinon vue aérienne IGN */}
        {(props.wikipedia || props.wikidata) && loading && !aerial && (
          <div className="flex items-center justify-center h-40 bg-gray-50 border border-gray-200 rounded-lg animate-pulse text-xs text-gray-400">
            {t("zones.panel.photoLoading")}
          </div>
        )}
        {imageUrl && (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={imageUrl}
              alt={displayName}
              loading="lazy"
              className="w-full h-44 object-cover bg-gray-100"
              onError={(e) => {
                (e.currentTarget.closest("figure") as HTMLElement).style.display =
                  "none";
              }}
            />
            <figcaption className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50">
              {isWikiPhoto && info?.photoCreditUrl ? (
                <a
                  href={info.photoCreditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-700 hover:underline"
                >
                  {t("zones.panel.photoCredit")}
                </a>
              ) : (
                t("zones.panel.aerialCredit")
              )}
            </figcaption>
          </figure>
        )}

        {/* Description (résumé Wikipédia) */}
        {info?.extract && (
          <p className="text-sm text-gray-700 leading-relaxed">{info.extract}</p>
        )}

        {/* Profil entreprise (sites Seveso) */}
        {hasCompanyProfile && (
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t("zones.panel.companySection")}
            </p>
            {renderInfoLine(t("zones.panel.activity"), props.naf)}
            {renderInfoLine(t("zones.panel.sector"), sectorLabel)}
            {renderInfoLine(t("zones.panel.since"), props.since)}
            {renderInfoLine(t("zones.panel.category"), categorieLabel)}
            {renderInfoLine(t("zones.panel.workforce"), effectifLabel)}
          </div>
        )}

        {/* Activités classées : ce que le site manipule */}
        {props.kind === "seveso" &&
          props.activites &&
          props.activites.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {t("zones.panel.activities")}
              </p>
              <ul className="space-y-1">
                {props.activites.map((a, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 flex items-start gap-2"
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Données */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
          {renderInfoLine(t("zones.panel.type"), t(`zones.kind.${props.kind}`))}
          {props.kind === "airport" &&
            renderInfoLine(
              t("zones.panel.codes"),
              [props.iata, props.icao].filter(Boolean).join(" / ") || null
            )}
          {props.kind === "seveso" && (
            <>
              {renderInfoLine(t("zones.panel.seuil"), props.seuil)}
              {renderInfoLine(t("zones.panel.regime"), props.regime)}
            </>
          )}
          {renderInfoLine(t("zones.panel.commune"), props.commune)}
          {renderInfoLine(t("zones.panel.address"), props.adresse)}
          {renderInfoLine(t("zones.panel.operator"), props.operator)}
        </div>

        {/* Liens + recentrage */}
        <div className="flex flex-wrap gap-2">
          {onCenterMap && (
            <button
              onClick={() => onCenterMap(selection)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              {t("zones.panel.centerOnMap")}
            </button>
          )}
          {info?.wikipediaUrl && (
            <a
              href={info.wikipediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
            >
              Wikipédia ↗
            </a>
          )}
          {props.website && (
            <a
              href={props.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              {t("zones.panel.website")} ↗
            </a>
          )}
        </div>

        {/* Commentaires */}
        {featureFlags.contextComments && (
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <CommentsThread
              comments={thread.comments}
              loading={thread.loading}
              posting={thread.posting}
              error={thread.error}
              onAdd={(text, user) => thread.addComment(text, user)}
            />
          </div>
        )}
    </SidePanelShell>
  );
};

export default ZoneDetailPanel;
