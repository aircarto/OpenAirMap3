import React from "react";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";
import { useTranslation } from "react-i18next";
import {
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  Building2,
  Gauge,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Minus,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { PlaneTrack } from "../../types";
import { getPlaneCategory, feetToMeters } from "../../constants/planes";
import { usePlanePhoto } from "../map/hooks/usePlanePhoto";
import { useContextThread } from "../map/hooks/useContextThread";
import CommentsThread from "../CommentsThread";
import { planeSubjectId } from "../../constants/context";
import { featureFlags } from "../../config/featureFlags";
import Flag from "../Flag";


interface PlaneSidePanelProps {
  isOpen: boolean;
  plane: PlaneTrack | null;
  onClose: () => void;
  onSizeChange?: (size: PanelSize) => void;
  panelSize?: PanelSize;
  onCenterMap?: (plane: PlaneTrack) => void;
}

const PlaneSidePanel: React.FC<PlaneSidePanelProps> = ({
  isOpen,
  plane,
  onClose,
  onSizeChange,
  panelSize = "normal",
  onCenterMap,
}) => {
  const { t } = useTranslation();
  const { info, loading: infoLoading } = usePlanePhoto(
    plane?.id ?? null,
    plane?.callsign ?? null
  );

  const thread = useContextThread(
    featureFlags.contextComments && plane ? planeSubjectId(plane.id) : null
  );

  if (!isOpen || !plane) return null;

  const category = getPlaneCategory(plane.category, plane.typeDesc);
  const title = plane.callsign || plane.registration || plane.id.toUpperCase();

  const row = (
    Icon: typeof Plane,
    label: string,
    value?: string | null
  ) => {
    if (!value) return null;
    return (
      <div className="flex items-center gap-2.5 text-sm">
        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
        <span className="text-gray-900 font-medium">{value}</span>
      </div>
    );
  };

  const vRate = plane.verticalRate;
  const VRateIcon = vRate == null || Math.abs(vRate) < 100 ? Minus : vRate > 0 ? ArrowUp : ArrowDown;

  return (
    <SidePanelShell
      isOpen={isOpen}
      panelSize={panelSize ?? "normal"}
      onSizeChange={(size) => onSizeChange?.(size)}
      onHidden={onClose}
      onClose={onClose}
      closeLabel={t("panels.closePanel")}
      width="compact"
      ariaLabel={title}
      title={
        <span className="flex items-center gap-2">
          <Plane className="w-5 h-5 flex-shrink-0" style={{ color: category.color }} />
          {title}
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            {t(`planes.types.${category.key}`)}
          </span>
          {plane.typeDesc && <span>{plane.typeDesc}</span>}
        </span>
      }
    >
        {/* Photo (adsbdb / airport-data.com) */}
        {infoLoading && (
          <div className="flex items-center justify-center h-40 bg-gray-50 border border-gray-200 rounded-lg animate-pulse text-xs text-gray-400">
            {t("planes.panel.photoLoading")}
          </div>
        )}
        {info?.photoThumbUrl && (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <img
              src={info.photoThumbUrl}
              alt={title}
              loading="lazy"
              className="w-full h-44 object-cover bg-gray-100"
              onError={(e) => {
                (e.currentTarget.closest("figure") as HTMLElement).style.display = "none";
              }}
            />
            <figcaption className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50">
              {t("planes.panel.photoCredit")}
            </figcaption>
          </figure>
        )}

        {/* Route (compagnie, origine -> destination) */}
        {(info?.origin || info?.destination || info?.airline) && (
          <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t("planes.panel.routeSection")}
            </p>
            {info.airline && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{info.airline}</span>
                {info.airlineCountry && (
                  <span className="text-gray-400">· {info.airlineCountry}</span>
                )}
              </div>
            )}
            <div className="flex items-stretch gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-gray-400 text-[11px] uppercase tracking-wide">
                  <PlaneTakeoff className="w-3.5 h-3.5" /> {t("planes.panel.from")}
                </div>
                {info.origin ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                      <Flag iso={info.origin.countryIso} />
                      {info.origin.iata || info.origin.icao}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {info.origin.municipality || info.origin.name}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
              <div className="flex items-center text-gray-300">
                <ArrowRight className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-end gap-1 text-gray-400 text-[11px] uppercase tracking-wide">
                  {t("planes.panel.to")} <PlaneLanding className="w-3.5 h-3.5" />
                </div>
                {info.destination ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 leading-tight flex items-center justify-end gap-1.5">
                      <Flag iso={info.destination.countryIso} />
                      {info.destination.iata || info.destination.icao}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {info.destination.municipality || info.destination.name}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Vol en cours */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {t("planes.panel.flightSection")}
          </p>
          {row(
            Gauge,
            t("planes.panel.altitude"),
            plane.onGround
              ? t("planes.panel.onGround")
              : plane.altitudeFt != null
              ? `${plane.altitudeFt.toLocaleString()} ft (${feetToMeters(plane.altitudeFt).toLocaleString()} m)`
              : null
          )}
          {row(
            Gauge,
            t("planes.panel.speed"),
            plane.speedKnots != null
              ? `${Math.round(plane.speedKnots)} kn (${Math.round(plane.speedKnots * 1.852)} km/h)`
              : null
          )}
          {row(
            Navigation,
            t("planes.panel.heading"),
            plane.trackDeg != null ? `${Math.round(plane.trackDeg)}°` : null
          )}
          {row(
            VRateIcon,
            t("planes.panel.verticalRate"),
            vRate != null ? `${vRate > 0 ? "+" : ""}${vRate} ft/min` : null
          )}
          {row(MapPin, t("planes.panel.squawk"), plane.squawk)}
        </div>

        {/* Identité */}
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {t("planes.panel.identitySection")}
          </p>
          {row(Plane, t("planes.panel.callsign"), plane.callsign)}
          {row(Plane, t("planes.panel.registration"), plane.registration)}
          {row(
            Plane,
            t("planes.panel.aircraft"),
            plane.typeDesc || plane.type
              ? `${plane.typeDesc ?? ""}${plane.type ? ` (${plane.type})` : ""}`.trim()
              : null
          )}
          {row(Plane, t("planes.panel.icao"), plane.id.toUpperCase())}
          {row(
            Building2,
            t("planes.panel.owner"),
            info?.owner
              ? `${info.owner}${info.ownerCountry ? ` · ${info.ownerCountry}` : ""}`
              : null
          )}
        </div>

        {/* Liens + recentrage */}
        <div className="flex flex-wrap gap-2">
          {onCenterMap && (
            <button
              onClick={() => onCenterMap(plane)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              {t("planes.panel.centerOnMap")}
            </button>
          )}
          {plane.callsign && (
            <a
              href={`https://www.flightradar24.com/${encodeURIComponent(plane.callsign)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
            >
              Flightradar24 <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a
            href={`https://globe.adsbexchange.com/?icao=${encodeURIComponent(plane.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          >
            ADSBexchange <ExternalLink className="w-3 h-3" />
          </a>
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

export default PlaneSidePanel;
