import React from "react";
import { useTranslation } from "react-i18next";
import { BoatTrack, BoatTrackPoint } from "../../types";
import { getBoatCategory } from "../../constants/boats";
import {
  getCountryForMmsi,
  getCountryName,
} from "../../constants/mmsiCountries";
import Flag from "../Flag";
import { useBoatExternalInfo } from "../map/hooks/useBoatExternalInfo";
import { useBoatMeta } from "../map/hooks/useBoatMeta";
import { useContextThread } from "../map/hooks/useContextThread";
import CommentsThread from "../CommentsThread";
import { boatSubjectId } from "../../constants/context";
import { featureFlags } from "../../config/featureFlags";

type PanelSize = "normal" | "fullscreen" | "hidden";

interface BoatSidePanelProps {
  isOpen: boolean;
  boat: BoatTrack | null;
  onClose: () => void;
  onSizeChange?: (size: PanelSize) => void;
  panelSize?: PanelSize;
  onCenterMap?: (boat: BoatTrack) => void;
}

const EARTH_RADIUS_M = 6371000;

/** Distance cumulée du tracé (km), somme des segments haversine */
const computeTrailDistanceKm = (points: BoatTrackPoint[]): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    const lat1 = toRad(points[i - 1].lat);
    const lat2 = toRad(points[i].lat);
    const dLat = lat2 - lat1;
    const dLon = toRad(points[i].lon - points[i - 1].lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    meters += 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return meters / 1000;
};

const BoatSidePanel: React.FC<BoatSidePanelProps> = ({
  isOpen,
  boat,
  onClose,
  onSizeChange,
  panelSize = "normal",
  onCenterMap,
}) => {
  const { t, i18n } = useTranslation();

  // Photo + liens Wikipédia/Wikidata depuis l'IMO (hook appelé avant tout
  // return pour respecter les règles des hooks ; no-op si pas d'IMO).
  const { info: externalInfo, loading: photoLoading } = useBoatExternalInfo(
    boat?.imo ?? null,
    i18n.language
  );

  // Métadonnées curées (image, propulsion, branchement à quai, actualités)
  // gérées en admin. Hook appelé avant tout return (règles des hooks).
  const { meta } = useBoatMeta(boat?.imo ?? null, boat?.id ?? null);

  // Fil de commentaires du bateau (sujet = "boat-<mmsi>")
  const thread = useContextThread(
    featureFlags.contextComments && boat ? boatSubjectId(boat.id) : null
  );

  if (!isOpen || !boat) {
    return null;
  }

  const category = getBoatCategory(boat.shipType);
  const displayName = boat.name ?? `MMSI ${boat.id}`;
  const country = getCountryForMmsi(boat.id);
  const countryName = country
    ? getCountryName(country.iso, i18n.language)
    : null;
  const trailDistanceKm = computeTrailDistanceKm(boat.points);
  const trailDurationMin =
    boat.points.length >= 2
      ? (boat.lastPoint.time - boat.points[0].time) / 60000
      : 0;

  const formatDateTime = (timeMs: number): string =>
    new Date(timeMs).toLocaleString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatTrailDuration = (): string => {
    if (trailDurationMin < 60) {
      return `${Math.round(trailDurationMin)} min`;
    }
    const hours = Math.floor(trailDurationMin / 60);
    const minutes = Math.round(trailDurationMin % 60);
    return `${hours}h ${minutes}min`;
  };

  // Statut de navigation AIS : seuls les codes standards 0-8 ont un libellé
  const navStatusLabel =
    boat.navStatus !== null && boat.navStatus >= 0 && boat.navStatus <= 8
      ? t(`boats.navStatus.${boat.navStatus}`)
      : null;

  const handlePanelSizeChange = (newSize: PanelSize) => {
    onSizeChange?.(newSize);
  };

  const getPanelClasses = () => {
    const baseClasses =
      "bg-white shadow-xl flex flex-col border-r border-gray-200 transition-all duration-300 h-full md:h-[calc(100vh-64px)] relative z-[1500]";

    switch (panelSize) {
      case "fullscreen":
        // En fullscreen, utiliser absolute pour ne pas affecter le layout de la carte
        return `${baseClasses} absolute inset-0 w-full`;
      case "hidden":
        return `${baseClasses} hidden`;
      case "normal":
      default:
        return `${baseClasses} w-full sm:w-[320px] md:w-[380px] lg:w-[420px] xl:w-[460px]`;
    }
  };

  const renderInfoLine = (label: string, value?: React.ReactNode) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 text-sm text-gray-700">
        <span className="font-medium text-gray-900 sm:w-44">{label}</span>
        <span className="flex-1">{value}</span>
      </div>
    );
  };

  return (
    <div className={getPanelClasses()}>
      {/* En-tête */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate flex items-center gap-2">
            {country && (
              <Flag iso={country.iso} className="text-xl flex-shrink-0" />
            )}
            <span className="truncate">{displayName}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: category.color }}
            >
              {t(`boats.types.${category.key}`)}
            </span>
            {countryName && <span className="text-gray-500">{countryName}</span>}
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() =>
              handlePanelSizeChange(
                panelSize === "fullscreen" ? "normal" : "fullscreen"
              )
            }
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={
              panelSize === "fullscreen"
                ? t("panels.shrinkPanel")
                : t("panels.expandPanel")
            }
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {panelSize === "fullscreen" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              )}
            </svg>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t("panels.closePanel")}
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Photo du navire (Wikimedia Commons via IMO). Affichée seulement si
            une fiche existe ; sinon on ne montre rien (pas de cadre vide). */}
        {/* Image curée (admin) — prioritaire sur la photo Wikimedia */}
        {meta?.image_url ? (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={meta.image_url}
              alt={displayName}
              loading="lazy"
              className="w-full h-44 object-cover bg-gray-100"
              onError={(e) => {
                (e.currentTarget.closest("figure") as HTMLElement).style.display =
                  "none";
              }}
            />
          </figure>
        ) : null}
        {!meta?.image_url && boat.imo !== null && photoLoading && (
          <div className="flex items-center justify-center h-40 bg-gray-50 border border-gray-200 rounded-lg animate-pulse text-xs text-gray-400">
            {t("boats.panel.photoLoading")}
          </div>
        )}
        {!meta?.image_url && externalInfo?.photoThumbUrl && (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={externalInfo.photoThumbUrl}
              alt={displayName}
              loading="lazy"
              className="w-full h-44 object-cover bg-gray-100"
              onError={(e) => {
                // Photo introuvable/supprimée : masquer proprement le cadre
                (e.currentTarget.closest("figure") as HTMLElement).style.display =
                  "none";
              }}
            />
            {externalInfo.photoCreditUrl && (
              <figcaption className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50">
                <a
                  href={externalInfo.photoCreditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-700 hover:underline"
                >
                  {t("boats.panel.photoCredit")}
                </a>
              </figcaption>
            )}
          </figure>
        )}

        {/* Navigation en cours */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {t("boats.panel.navigationSection")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDateTime(boat.lastPoint.time)}
              </p>
            </div>
            {onCenterMap && (
              <button
                onClick={() => onCenterMap(boat)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 2l7 7-7 7-7-7 7-7z"
                  />
                </svg>
                {t("boats.panel.centerOnMap")}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {renderInfoLine(
              t("boats.popup.speed"),
              boat.speedKnots !== null
                ? `${boat.speedKnots.toFixed(1)} ${t("boats.popup.knots")}`
                : null
            )}
            {renderInfoLine(
              t("boats.popup.course"),
              boat.courseDeg !== null ? `${Math.round(boat.courseDeg)}°` : null
            )}
            {renderInfoLine(t("boats.panel.navStatus"), navStatusLabel)}
            {renderInfoLine(t("boats.panel.destination"), boat.destination)}
            {renderInfoLine(
              t("boats.panel.position"),
              `${boat.lastPoint.lat.toFixed(5)}, ${boat.lastPoint.lon.toFixed(5)}`
            )}
          </div>
        </div>

        {/* Trajet observé */}
        {boat.points.length >= 2 && (
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t("boats.panel.trailSection")}
            </p>
            {renderInfoLine(
              t("boats.panel.trailDistance"),
              `${
                trailDistanceKm < 10
                  ? trailDistanceKm.toFixed(1)
                  : Math.round(trailDistanceKm)
              } km`
            )}
            {renderInfoLine(t("boats.panel.trailDuration"), formatTrailDuration())}
            {renderInfoLine(
              t("boats.panel.trailPoints"),
              String(boat.points.length)
            )}
          </div>
        )}

        {/* Identité */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t("boats.panel.identitySection")}
          </p>
          {renderInfoLine(t("boats.panel.operator"), meta?.operator)}
          {renderInfoLine(t("boats.popup.mmsi"), boat.id)}
          {renderInfoLine(
            t("boats.panel.imo"),
            boat.imo !== null ? String(boat.imo) : null
          )}
          {renderInfoLine(t("boats.panel.callsign"), boat.callsign)}
          {renderInfoLine(
            t("boats.panel.flag"),
            countryName ? (
              <span className="inline-flex items-center gap-1.5">
                {country && <Flag iso={country.iso} />}
                {countryName}
              </span>
            ) : null
          )}
          {renderInfoLine(
            t("boats.popup.type"),
            boat.shipType !== null
              ? `${t(`boats.types.${category.key}`)} (${boat.shipType})`
              : t(`boats.types.${category.key}`)
          )}
          {renderInfoLine(
            t("boats.panel.aisClass"),
            boat.aisClass ? `${t("boats.panel.aisClassValue")} ${boat.aisClass}` : null
          )}
        </div>

        {/* Caractéristiques (AIS + champs curés : propulsion, quai, année…) */}
        {(boat.lengthM !== null ||
          boat.widthM !== null ||
          boat.draughtM !== null ||
          meta?.propulsion ||
          meta?.shore_power ||
          meta?.length_m != null ||
          meta?.year_built != null ||
          meta?.passengers != null ||
          meta?.vehicles != null) && (
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t("boats.panel.characteristicsSection")}
            </p>
            {renderInfoLine(
              t("boats.panel.dimensions"),
              (() => {
                // Longueur curée prioritaire sur l'AIS ; largeur depuis l'AIS.
                const len = meta?.length_m ?? boat.lengthM;
                if (len !== null && boat.widthM !== null)
                  return `${len} × ${boat.widthM} m`;
                if (len !== null) return `${len} m`;
                return null;
              })()
            )}
            {renderInfoLine(
              t("boats.panel.draught"),
              boat.draughtM !== null ? `${boat.draughtM} m` : null
            )}
            {renderInfoLine(t("boats.panel.propulsion"), meta?.propulsion)}
            {renderInfoLine(
              t("boats.panel.shorePower"),
              meta?.shore_power
                ? t(`boats.panel.shorePowerValues.${meta.shore_power}`, meta.shore_power)
                : null
            )}
            {renderInfoLine(
              t("boats.panel.yearBuilt"),
              meta?.year_built != null ? String(meta.year_built) : null
            )}
            {renderInfoLine(
              t("boats.panel.passengers"),
              meta?.passengers != null
                ? meta.passengers.toLocaleString(i18n.language)
                : null
            )}
            {renderInfoLine(
              t("boats.panel.vehicles"),
              meta?.vehicles != null
                ? meta.vehicles.toLocaleString(i18n.language)
                : null
            )}
          </div>
        )}

        {/* Liens externes (photos et fiches détaillées) */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {t("boats.panel.externalLinks")}
          </p>
          <p className="text-xs text-gray-500">
            {t("boats.panel.externalLinksHint")}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {externalInfo?.wikipediaUrl && (
              <a
                href={externalInfo.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
              >
                Wikipédia ↗
              </a>
            )}
            <a
              href={`https://www.vesselfinder.com/vessels/details/${boat.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              VesselFinder ↗
            </a>
            <a
              href={`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${boat.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              MarineTraffic ↗
            </a>
          </div>

          {/* Actualités curées (0..N articles) */}
          {meta?.news_articles && meta.news_articles.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-xs font-medium text-gray-900">
                {t("boats.panel.news")}
              </p>
              <ul className="space-y-1.5">
                {meta.news_articles.map((article, i) => (
                  <li key={i} className="text-sm leading-snug">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-blue-600 underline break-words hover:text-blue-800"
                    >
                      {article.title || article.url}
                    </a>
                    {article.source && (
                      <span className="text-xs text-gray-400"> — {article.source}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
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
      </div>
    </div>
  );
};

export default BoatSidePanel;
