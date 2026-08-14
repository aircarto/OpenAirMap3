import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DomainConfig } from '../../config/domainConfig';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
import { getMarkerPath } from '../../utils';

type TimeStepStatus = 'available' | 'limited' | 'unavailable';

type TimeStepCode = 'instantane' | 'deuxMin' | 'quartHeure' | 'heure' | 'jour';

type ModalView = 'info' | 'legal';

interface TimeStepInfo {
  stepCode: TimeStepCode;
  status: TimeStepStatus;
  note?: string;
}

interface DataProvider {
  label: string;
  href?: string;
}

type IconDescriptor =
  | { kind: 'marker'; source: string }
  | { kind: 'badge'; label: string };

interface DataSourceItem {
  id: string;
  icon: IconDescriptor;
  timeSteps: TimeStepInfo[];
  provider: DataProvider;
  highlights?: string[];
}

const DATA_SOURCES: DataSourceItem[] = [
  {
    id: 'atmo-ref',
    icon: { kind: 'marker', source: 'atmoRef' },
    timeSteps: [
      { stepCode: 'instantane', status: 'available' },
      { stepCode: 'deuxMin', status: 'unavailable' },
      { stepCode: 'quartHeure', status: 'available' },
      { stepCode: 'heure', status: 'available' },
      { stepCode: 'jour', status: 'available' },
    ],
    provider: { label: 'AtmoSud', href: 'https://www.atmosud.org' },
  },
  {
    id: 'atmo-micro',
    icon: { kind: 'marker', source: 'atmoMicro' },
    timeSteps: [
      { stepCode: 'instantane', status: 'available' },
      { stepCode: 'deuxMin', status: 'available' },
      { stepCode: 'quartHeure', status: 'available' },
      { stepCode: 'heure', status: 'available' },
      { stepCode: 'jour', status: 'unavailable' },
    ],
    provider: { label: 'AtmoSud', href: 'https://www.atmosud.org' },
    highlights: ['NebuleAir', 'Kunak', 'Nexelec'],
  },
  {
    id: 'nebuleair',
    icon: { kind: 'marker', source: 'nebuleair' },
    timeSteps: [
      { stepCode: 'instantane', status: 'available' },
      { stepCode: 'deuxMin', status: 'available' },
      { stepCode: 'quartHeure', status: 'available' },
      { stepCode: 'heure', status: 'available' },
      { stepCode: 'jour', status: 'available' },
    ],
    provider: { label: 'AirCarto', href: 'https://aircarto.com' },
  },
  {
    id: 'sensor-community',
    icon: { kind: 'marker', source: 'sensorCommunity' },
    timeSteps: [
      { stepCode: 'instantane', status: 'available' },
      { stepCode: 'deuxMin', status: 'available' },
      { stepCode: 'quartHeure', status: 'unavailable' },
      { stepCode: 'heure', status: 'unavailable' },
      { stepCode: 'jour', status: 'unavailable' },
    ],
    provider: { label: 'Sensor.Community', href: 'https://sensor.community' },
  },
  {
    id: 'purpleair',
    icon: { kind: 'marker', source: 'purpleair' },
    timeSteps: [
      { stepCode: 'instantane', status: 'available' },
      { stepCode: 'deuxMin', status: 'available' },
      { stepCode: 'quartHeure', status: 'unavailable' },
      { stepCode: 'heure', status: 'unavailable' },
      { stepCode: 'jour', status: 'unavailable' },
    ],
    provider: { label: 'PurpleAir', href: 'https://www.purpleair.com' },
  },
  {
    id: 'modeling-pm',
    icon: { kind: 'badge', label: 'mod' },
    timeSteps: [
      { stepCode: 'instantane', status: 'unavailable' },
      { stepCode: 'deuxMin', status: 'unavailable' },
      { stepCode: 'quartHeure', status: 'available' },
      { stepCode: 'heure', status: 'available' },
      { stepCode: 'jour', status: 'unavailable' },
    ],
    provider: { label: 'AtmoSud', href: 'https://www.atmosud.org' },
  },
];

const STEP_STYLES: Record<TimeStepStatus, string> = {
  available: 'bg-[#4271B3] text-white border-[#4271B3]',
  limited: 'bg-amber-100 text-amber-700 border-amber-200',
  unavailable: 'bg-[#E5E7EB] text-black border-gray-300',
};

interface InformationModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainConfig: DomainConfig;
}

const InformationModal: React.FC<InformationModalProps> = ({
  isOpen,
  onClose,
  domainConfig,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ModalView>('info');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const legal = domainConfig.legal;

  const getFocusables = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setView('info');
      return;
    }
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveRef.current?.focus) {
        previousActiveRef.current.focus({ preventScroll: true });
      }
    };
  }, [isOpen, onClose, getFocusables]);

  if (!isOpen) {
    return null;
  }

  const renderIcon = (icon: IconDescriptor) => {
    if (icon.kind === 'marker') {
      const path = getMarkerPath(icon.source, 'bon');
      return (
        <img
          src={path}
          alt={t('infoModal.iconAlt', { source: icon.source })}
          className="h-9 w-9 object-contain drop-shadow"
        />
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
        {icon.label}
      </span>
    );
  };

  const renderInfoContent = () => (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 id="info-modal-title" className="text-2xl font-semibold text-slate-800">
            {t('infoModal.welcome')}
          </h2>
          <p id="info-modal-intro" className="max-w-2xl text-sm text-slate-600">
            {t('infoModal.intro')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <img
            src={domainConfig.logo2}
            alt={t('infoModal.logoAirCarto')}
            className="h-12 w-auto object-contain"
          />
          <img
            src={domainConfig.logo}
            alt={`Logo ${domainConfig.organization}`}
            className="h-12 w-auto object-contain"
          />
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 pb-3 pt-5 sm:px-10">
          <h3 className="text-lg font-semibold text-slate-800">
            {t('infoModal.dataListTitle')}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {t('infoModal.dataListNote')}
          </p>
        </div>
        <div className="hidden border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-12 sm:gap-4">
          <div className="col-span-3">{t('infoModal.measureType')}</div>
          <div className="col-span-1">{t('infoModal.icon')}</div>
          <div className="col-span-4">{t('controls.timeStep')}</div>
          <div className="col-span-3">{t('infoModal.description')}</div>
          <div className="col-span-1 text-center">{t('infoModal.source')}</div>
        </div>
        <div className="divide-y divide-slate-100">
          {DATA_SOURCES.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 px-4 py-5 text-sm text-slate-700 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-6"
            >
              <div className="col-span-12 flex flex-col gap-1 sm:col-span-3">
                <span className="text-sm font-semibold text-slate-800">
                  {t(`infoModal.sources.${item.id}.title`)}
                </span>
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {t(`infoModal.sources.${item.id}.category`)}
                </span>
                {item.highlights && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-12 flex flex-col sm:col-span-1 sm:flex-row sm:items-center sm:justify-center">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                  {t('infoModal.icon')}
                </span>
                <div className="mt-1 sm:mt-0 flex items-center justify-start">
                  {renderIcon(item.icon)}
                </div>
              </div>
              <div className="col-span-12 sm:col-span-4">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                  {t('controls.timeStep')}
                </span>
                <div className="mt-1 flex flex-wrap items-start gap-2">
                  {item.timeSteps.map((step) => (
                    <div key={step.stepCode} className="flex flex-col items-start">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${STEP_STYLES[step.status]}`}
                      >
                        {t(`timeSteps.${step.stepCode}`)}
                      </span>
                      {step.note && (
                        <span className="mt-1 text-[11px] text-slate-500">
                          {step.note}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                  {t('infoModal.description')}
                </span>
                <div className="mt-1 text-sm leading-snug text-slate-600 sm:mt-0">
                  {item.id === 'atmo-micro' ? (
                    <span className="inline-flex items-center gap-2">
                      <span>{t(`infoModal.sources.${item.id}.description`)}</span>
                      <span className="inline-flex h-5 w-6 items-center justify-center rounded-full bg-[#0074d9]/70 leading-none" role="img" aria-label={t('infoModal.consolidatedData')}>
                        <svg width="14" height="14" viewBox="0 0 16 16" className="h-5 w-5 text-white">
                          <path fill="currentColor" d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z" />
                          <path fill="currentColor" d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z" />
                        </svg>
                      </span>
                    </span>
                  ) : (
                    t(`infoModal.sources.${item.id}.description`)
                  )}
                </div>
              </div>
              <div className="col-span-12 flex flex-col items-start justify-start sm:col-span-1 sm:flex-row sm:items-center sm:justify-center">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                  {t('infoModal.source')}
                </span>
                {item.provider.href ? (
                  <div className="mt-1 sm:mt-0">
                    <a
                      href={item.provider.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-[#4271B3] px-1.5 py-0.5 text-[0.58rem] font-semibold leading-tight text-white shadow-sm transition hover:bg-[#325a96] whitespace-nowrap"
                    >
                      {item.provider.label}
                    </a>
                  </div>
                ) : (
                  <span className="mt-2 text-xs font-medium text-slate-500 sm:mt-0">
                    {item.provider.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.discoverHistorical')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.discoverHistoricalText')}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>{t('infoModal.discoverHistoricalBullet1')}</li>
          <li>{t('infoModal.discoverHistoricalBullet2')}</li>
          <li>{t('infoModal.discoverHistoricalBullet3')}</li>
          <li>{t('infoModal.discoverHistoricalBullet4')}</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.comparisonTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.comparisonText')}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>{t('infoModal.comparisonBullet1')}</li>
          <li>{t('infoModal.comparisonBullet2')}</li>
          <li>{t('infoModal.comparisonBullet3')}</li>
        </ul>
      </section>
    </>
  );

  const renderLegalContent = () => (
    <>
      <header className="flex flex-col gap-2">
        <h2 id="info-modal-title" className="text-2xl font-semibold text-slate-800">
          {t('infoModal.legal.title')}
        </h2>
        <p id="info-modal-intro" className="max-w-2xl text-sm text-slate-600">
          {t('infoModal.legal.intro', { app: domainConfig.title })}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.editorTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.legal.editorText', {
            organization: domainConfig.organization,
            app: domainConfig.title,
          })}
        </p>
        {legal && (
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              {t('infoModal.legal.legalFormLabel')}: {legal.legalForm}
            </li>
            <li>
              {t('infoModal.legal.siretLabel')}: {legal.siret}
            </li>
            {legal.vatNumber && (
              <li>
                {t('infoModal.legal.vatLabel')}: {legal.vatNumber}
              </li>
            )}
            <li>
              {t('infoModal.legal.addressLabel')}: {legal.address}
            </li>
            <li>
              {t('infoModal.legal.representativeLabel')}: {legal.legalRepresentative}
            </li>
            <li>
              {t('infoModal.legal.contactLabel')}:{' '}
              <a
                className="text-[#4271B3] hover:underline"
                href={domainConfig.links.contact}
                target="_blank"
                rel="noopener noreferrer"
              >
                {domainConfig.links.contact}
              </a>
            </li>
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.publicationTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {legal?.publicationDirector ?? domainConfig.organization}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.hostingTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.legal.hostingText', {
            organization: domainConfig.organization,
            hosting: legal?.hosting ?? domainConfig.organization,
          })}
        </p>
        {legal?.hostingProvider && (
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>
              {t('infoModal.legal.legalFormLabel')} : {legal.hostingProvider.legalForm}
            </li>
            <li>
              {t('infoModal.legal.rcsLabel')} : {legal.hostingProvider.rcs}
            </li>
            <li>
              {t('infoModal.legal.siretLabel')} : {legal.hostingProvider.siret}
            </li>
            <li>
              {t('infoModal.legal.shareCapitalLabel')} : {legal.hostingProvider.shareCapital}
            </li>
            <li>
              {t('infoModal.legal.addressLabel')} : {legal.hostingProvider.address}
            </li>
            <li>
              {t('infoModal.legal.vatLabel')} : {legal.hostingProvider.vatNumber}
            </li>
            <li>
              {t('infoModal.legal.representativeLabel')} :{' '}
              {legal.hostingProvider.legalRepresentative}
            </li>
            <li>
              {t('infoModal.legal.phoneLabel')} : {legal.hostingProvider.phone}
            </li>
            <li>
              {t('infoModal.legal.emailLabel')} :{' '}
              <a
                className="text-[#4271B3] hover:underline"
                href={`mailto:${legal.hostingProvider.email}`}
              >
                {legal.hostingProvider.email}
              </a>
            </li>
            <li>
              {t('infoModal.legal.websiteLabel')} :{' '}
              <a
                className="text-[#4271B3] hover:underline"
                href={legal.hostingProvider.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {legal.hostingProvider.website}
              </a>
            </li>
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.dpoTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.legal.dpoTextBefore')}{' '}
          {legal?.dpo ? (
            <a
              className="text-[#4271B3] hover:underline"
              href={`mailto:${legal.dpo}`}
            >
              {legal.dpo}
            </a>
          ) : (
            '[À compléter]'
          )}
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.openSourceTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.legal.openSourceText')}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          {t('infoModal.legal.personalDataTitle')}
        </h3>
        <p className="mt-2 leading-relaxed">
          {t('infoModal.legal.personalDataText')}
        </p>
        {legal?.privacyPolicyUrl && (
          <p className="mt-3">
            <a
              className="text-[#4271B3] hover:underline"
              href={legal.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('infoModal.legal.privacyPolicyLink')}
            </a>
          </p>
        )}
      </section>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm px-3 py-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      aria-describedby="info-modal-intro"
      ref={dialogRef}
    >
      <div className="relative w-full max-w-5xl max-h-[85vh] md:max-h-[80vh]">
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-gray-200 p-1.5 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-900"
            aria-label={t('panels.closeInfoModal')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-6 bg-gradient-to-br from-[#f4f8ff] via-white to-white px-6 pb-6 pt-8 sm:px-10">
              {view === 'info' ? renderInfoContent() : renderLegalContent()}
            </div>
          </div>

          <footer className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-10">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              {view === 'info' ? (
                <>
                  <span>
                    {t('infoModal.footer')}{' '}
                    <a
                      className="text-[#4271B3] hover:underline"
                      href={domainConfig.links.contact}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {domainConfig.organization}
                    </a>
                    .
                  </span>
                  <button
                    type="button"
                    onClick={() => setView('legal')}
                    className="text-left text-[#4271B3] hover:underline sm:border-l sm:border-slate-200 sm:pl-3"
                  >
                    {t('infoModal.legal.link')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setView('info')}
                  className="text-left text-[#4271B3] hover:underline"
                >
                  {t('infoModal.legal.back')}
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-md bg-[#4271B3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#325a96]"
            >
              {t('infoModal.understood')}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default InformationModal;
