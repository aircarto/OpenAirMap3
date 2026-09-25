import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MobileAirMatchedReport } from '../../types';
import MobileAirContextTypeIcon from './MobileAirContextTypeIcon';
import { cn } from '../../lib/utils';

interface MobileAirReportsSectionProps {
  reports: MobileAirMatchedReport[];
  selectedReportId?: string | null;
  onReportClick: (report: MobileAirMatchedReport) => void;
}

/**
 * Liste des signalements du relevé (panneau détail — pas de marqueurs carte).
 */
export const MobileAirReportsSection: React.FC<MobileAirReportsSectionProps> = ({
  reports,
  selectedReportId,
  onReportClick,
}) => {
  const { t, i18n } = useTranslation();
  const [expandedPhotoId, setExpandedPhotoId] = useState<string | null>(null);

  if (reports.length === 0) return null;

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      data-testid="mobileair-reports-section"
      className="space-y-2 rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] p-3"
    >
      <h3 className="text-center text-xs font-medium text-[color:var(--fg-muted)]">
        {t('panels.mobileAirDetail.reportsTitle', { count: reports.length })}
      </h3>
      <ul className="space-y-2">
        {reports.map((report) => {
          const selected = selectedReportId === report.id;
          const photo = report.photos[0];
          const photoOpen = expandedPhotoId === report.id;
          return (
            <li key={report.id}>
              <button
                type="button"
                data-testid={`mobileair-report-${report.id}`}
                onClick={() => onReportClick(report)}
                className={cn(
                  'flex w-full min-h-11 items-start gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors',
                  selected
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-[rgb(16_32_56_/_0.09)] bg-white/70 hover:bg-black/[0.03]'
                )}
              >
                <MobileAirContextTypeIcon
                  contextType={report.contextType}
                  className="mt-0.5 text-[color:var(--fg-muted)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-[color:var(--fg)]">
                    {t(`mobileAir.contextType.${report.contextType}`, {
                      defaultValue: report.contextType,
                    })}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[color:var(--fg-muted)]">
                    {formatDate(report.datetimeStart)}
                  </span>
                  {report.comments ? (
                    <span className="mt-1 block line-clamp-2 text-[color:var(--fg)]">
                      {report.comments}
                    </span>
                  ) : null}
                </span>
              </button>
              {photo && (
                <div className="mt-1 pl-1">
                  <button
                    type="button"
                    className="text-[10px] font-medium text-blue-600 hover:underline"
                    onClick={() =>
                      setExpandedPhotoId((prev) =>
                        prev === report.id ? null : report.id
                      )
                    }
                  >
                    {photoOpen
                      ? t('panels.mobileAirDetail.hidePhoto')
                      : t('panels.mobileAirDetail.showPhoto')}
                  </button>
                  {photoOpen && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={t('panels.mobileAirDetail.photoAlt')}
                      className="mt-1 max-h-40 w-full rounded-md border border-[rgb(16_32_56_/_0.09)] object-cover"
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MobileAirReportsSection;
