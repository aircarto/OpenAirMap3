import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SignalAirReport } from "../../types";
import { convertWGS84ToLambert93 } from "../../utils/coordinateUtils";
import SidePanelShell, { type PanelSize } from "./SidePanelShell";

interface SignalAirDetailPanelProps {
  isOpen: boolean;
  report: SignalAirReport | null;
  onClose: () => void;
  onHidden?: () => void;
  onSizeChange: (size: PanelSize) => void;
  panelSize: PanelSize;
  onCenterMap?: (report: SignalAirReport) => void;
}

const SIGNAL_TYPE_EMOJI: Record<string, string> = {
  odeur: "👃",
  bruit: "🔊",
  brulage: "🔥",
  visuel: "👀",
};

const SignalAirDetailPanel: React.FC<SignalAirDetailPanelProps> = ({
  isOpen,
  report,
  onClose,
  onHidden,
  onSizeChange,
  panelSize,
  onCenterMap,
}) => {
  const { t, i18n } = useTranslation();

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return t("panels.signalAirDetail.dateNotSpecified");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "en" ? "en-GB" : i18n.language === "de" ? "de-DE" : i18n.language === "ar" ? "ar-SA" : i18n.language;
    return date.toLocaleString(locale, {
      dateStyle: "long",
      timeStyle: "short",
    });
  };


  const renderInfoLine = (
    label: string,
    value?: string | null | undefined
  ) => {
    if (!value) {
      return null;
    }

    const trimmed =
      typeof value === "string"
        ? value.trim()
        : String(value).trim();

    if (!trimmed) {
      return null;
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 text-sm text-[color:var(--fg-muted)]">
        <span className="font-medium text-[color:var(--fg)] sm:w-48">{label}</span>
        <span className="flex-1 whitespace-pre-line">{trimmed}</span>
      </div>
    );
  };

  const typeInformation = useMemo(() => {
    if (!report?.signalType) {
      return null;
    }
    const labelKey = `panels.signalAirSelection.types.${report.signalType}.label`;
    const label = t(labelKey);
    const emoji = SIGNAL_TYPE_EMOJI[report.signalType] ?? "ℹ️";
    return { label: label !== labelKey ? label : report.signalType, emoji };
  }, [report?.signalType, t]);

  const handleCenterMapClick = () => {
    if (report && onCenterMap) {
      onCenterMap(report);
    }
  };

  // Calcul des coordonnées Lambert 93
  const lambert93Coords = useMemo(() => {
    if (!report) {
      return null;
    }
    return convertWGS84ToLambert93(report.latitude, report.longitude);
  }, [report]);

  const handleCopyCoordinate = async (type: "x" | "y") => {
    if (!lambert93Coords) {
      return;
    }

    const text =
      type === "x"
        ? Math.round(lambert93Coords.x).toString()
        : Math.round(lambert93Coords.y).toString();

    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error(`Erreur lors de la copie de la coordonnée ${type} :`, error);
    }
  };

  if (!isOpen || !report) {
    return null;
  }

  const symptomsList =
    report.signalHasSymptoms === "Oui" && report.signalSymptoms
      ? report.signalSymptoms.split("|").map((symptom) => symptom.trim())
      : [];
  const remarks = report.remarks ? report.remarks.trim() : "";
  const additionalDescription = report.signalDescription
    ? report.signalDescription.trim()
    : "";

  return (
    <SidePanelShell
      isOpen={isOpen}
      panelSize={panelSize}
      onSizeChange={onSizeChange}
      onHidden={onHidden}
      width="compact"
      testId="signalair-detail-panel"
      ariaLabel={report.name || t("panels.signalAirDetail.defaultReportName")}
      title={report.name || t("panels.signalAirDetail.defaultReportName")}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[color:var(--fg-muted)] mt-1">
          {typeInformation && (
            <span className="inline-flex items-center space-x-1">
              <span aria-hidden="true" className="text-base">
                {typeInformation.emoji}
              </span>
              <span>
                {typeInformation.label ||
                  report.signalType ||
                  t("panels.signalAirDetail.typeUnspecified")}
              </span>
            </span>
          )}
          {report.city && (
            <span className="inline-flex items-center space-x-1 text-[color:var(--fg-muted)]">
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
              d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.5 10.5C19.5 16.5 12 21 12 21s-7.5-4.5-7.5-10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <span>
            {report.city}
            {report.postalCode ? ` (${report.postalCode})` : ""}
          </span>
        </span>
      )}
      {report.nuisanceLevel && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
          {report.nuisanceLevel}
        </span>
      )}
    </div>
  }
>
      <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">
              {t("panels.signalAirDetail.timeline")}
            </p>
            <p className="text-sm font-semibold text-[color:var(--fg)]">
              {formatDateTime(report.signalCreatedAt)}
            </p>
          </div>
          {onCenterMap && (
            <button
              onClick={handleCenterMapClick}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-[var(--r-sm)] hover:bg-blue-100 transition-colors"
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
              {t("panels.signalAirDetail.centerOnMap")}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {renderInfoLine(
            t("panels.signalAirDetail.observation"),
            report.signalDate ? formatDateTime(report.signalDate) : null
          )}
          {renderInfoLine(
            t("panels.signalAirDetail.declaredOn"),
            formatDateTime(report.signalCreatedAt)
          )}
          {renderInfoLine(t("panels.signalAirDetail.declaredDuration"), report.signalDuration)}
              
        </div>
      </div>

          

      {(report.nuisanceOrigin ||
        report.nuisanceOriginDescription ||
        report.industrialSource ||
        report.nuisanceLevel) && (
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-3">
          <p className="text-sm font-semibold text-[color:var(--fg)]">
            {t("panels.signalAirDetail.nuisanceInfoTitle")}
          </p>
          <div className="space-y-2">
            {renderInfoLine(t("panels.signalAirDetail.declaredOrigin"), report.nuisanceOrigin)}
            {renderInfoLine(
              t("panels.signalAirDetail.originDescription"),
              report.nuisanceOriginDescription
            )}
            {renderInfoLine(
              t("panels.signalAirDetail.industrialSource"),
              report.industrialSource
            )}
            {renderInfoLine(t("panels.signalAirDetail.nuisanceLevel"), report.nuisanceLevel)}
          </div>
        </div>
      )}

      {(report.signalHasSymptoms ||
        symptomsList.length > 0 ||
        report.symptomsDetails) && (
        <div className="border border-orange-200 bg-orange-50 rounded-[var(--r-md)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-semibold text-orange-800">
              {t("panels.signalAirDetail.healthAndFeelings")}
            </p>
            {report.signalHasSymptoms && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-orange-700 border border-orange-200">
                {report.signalHasSymptoms}
              </span>
            )}
          </div>
          {symptomsList.length > 0 && (
            <ul className="list-disc list-inside text-sm text-orange-900 space-y-1">
              {symptomsList.map((symptom) => (
                <li key={symptom}>{symptom}</li>
              ))}
            </ul>
          )}
          {report.symptomsDetails && (
            <p className="text-sm text-orange-900 whitespace-pre-line">
              {report.symptomsDetails.trim()}
            </p>
          )}
          {!symptomsList.length &&
            !report.symptomsDetails &&
            report.signalHasSymptoms && (
              <p className="text-sm text-orange-900">
                {t("panels.signalAirDetail.declarantResponse", {
                  value: report.signalHasSymptoms,
                })}
              </p>
            )}
        </div>
      )}

      {remarks && (
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-2">
          <p className="text-sm font-semibold text-[color:var(--fg)]">
            {t("panels.signalAirDetail.remarkComment")}
          </p>
          <p className="text-sm text-[color:var(--fg-muted)] whitespace-pre-line">
            {remarks}
          </p>
        </div>
      )}

      {additionalDescription && (
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-2">
          <p className="text-sm font-semibold text-[color:var(--fg)]">
            {t("panels.signalAirDetail.additionalDescription")}
          </p>
          <p className="text-sm text-[color:var(--fg-muted)] whitespace-pre-line">
            {additionalDescription}
          </p>
        </div>
      )}

      {report.photoUrl && report.photoUrl.trim() && (
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-2">
          <p className="text-sm font-semibold text-[color:var(--fg)]">
            {t("panels.signalAirDetail.associatedResource")}
          </p>
          <a
            href={report.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
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
                d="M15 10l4.553-4.553a2.121 2.121 0 00-3-3L12 7l-1.5-1.5M17 17H7m0 0l4-4m-4 4l4 4"
              />
            </svg>
            {t("panels.signalAirDetail.viewResource")}
          </a>
        </div>
      )}
      {(report.city ||
        report.postalCode ||
        report.cityCode ||
        report.address ||
        report.locationHint ||
        report.groupName) && (
        <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-3">
          <p className="text-sm font-semibold text-[color:var(--fg)]">
            {t("panels.signalAirDetail.concernedArea")}
          </p>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-[color:var(--fg-muted)]">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="font-medium text-[color:var(--fg)] sm:w-48">
                  {t("panels.signalAirDetail.coordXLambert93")}
                </span>
                <span className="flex-1 font-mono">
                  {lambert93Coords
                    ? Math.round(lambert93Coords.x).toString()
                    : t("panels.signalAirDetail.calculating")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCoordinate("x")}
                className="inline-flex items-center justify-center p-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded-[var(--r-sm)] hover:bg-blue-100 transition-colors"
                title={t("panels.copyCoordX")}
                disabled={!lambert93Coords}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-[color:var(--fg-muted)]">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="font-medium text-[color:var(--fg)] sm:w-48">
                  {t("panels.signalAirDetail.coordYLambert93")}
                </span>
                <span className="flex-1 font-mono">
                  {lambert93Coords
                    ? Math.round(lambert93Coords.y).toString()
                    : t("panels.signalAirDetail.calculating")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCoordinate("y")}
                className="inline-flex items-center justify-center p-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded-[var(--r-sm)] hover:bg-blue-100 transition-colors"
                title={t("panels.copyCoordY")}
                disabled={!lambert93Coords}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            {renderInfoLine(t("panels.signalAirDetail.city"), report.city)}
            {renderInfoLine(t("panels.signalAirDetail.postalCode"), report.postalCode)}
            {renderInfoLine(t("panels.signalAirDetail.country"), report.countryCode)}
            {renderInfoLine(
              t("panels.signalAirDetail.addressOrPlace"),
              report.address || report.locationHint
            )}
          </div>
        </div>
      )}
      <div className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--fg)] mb-1">
            {t("panels.signalAirDetail.needToActTitle")}
          </p>
          <p className="text-sm text-[color:var(--fg-muted)]">
            {t("panels.signalAirDetail.needToActDescription")}
          </p>
        </div>

        <a
          href="https://www.signalair.eu/fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-[color:var(--fg-muted)] bg-[rgb(16_32_56_/_0.03)] border border-[rgb(16_32_56_/_0.14)] rounded-[var(--r-sm)] hover:bg-black/5 hover:border-[rgb(16_32_56_/_0.20)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          {t("panels.signalAirDetail.reportNewNuisance")}
        </a>
      </div>
    </SidePanelShell>
  );
};

export default SignalAirDetailPanel;


