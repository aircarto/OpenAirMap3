import type { MicrospotCampaignListItem } from '../../types';

export type PeriodStartSource = 'campaign' | 'oldestDevice' | 'none';
export type PeriodEndSource = 'campaign' | 'lastDevice' | 'today';

export interface ResolvedCampaignPeriod {
  /** null quand ni la campagne ni ses capteurs ne sont datés : saisie manuelle. */
  start: Date | null;
  end: Date;
  startSource: PeriodStartSource;
  endSource: PeriodEndSource;
  /**
   * Premier capteur, s'il a démarré avant le début de campagne retenu
   * (ex. #48 « Essais en Atelier » : campagne au 2026-09-15, capteurs depuis
   * 2023-01-11). Sert à proposer d'étendre la période.
   */
  earlierDeviceStart: Date | null;
}

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Période préremplie d'une campagne (l'utilisateur peut la modifier).
 *
 * Mesuré le 2026-11-19 : 9 campagnes exposées sur 22 sans start_date, 19 sans
 * end_date, et des end_date prévisionnelles en 2027.
 *
 * - Début : start_date de la campagne si renseignée, sinon le capteur le plus ancien.
 * - Fin : end_date de la campagne si renseignée ; sinon fin du dernier capteur si
 *   tous sont clos ; sinon maintenant. Toujours plafonnée à maintenant.
 */
export function resolveCampaignPeriod(
  campaign: Pick<MicrospotCampaignListItem, 'start_date' | 'end_date' | 'devices'>,
  now: Date = new Date()
): ResolvedCampaignPeriod {
  const devices = campaign.devices ?? [];

  const deviceStarts = devices
    .map((d) => parseDate(d.start_date))
    .filter((d): d is Date => d !== null);
  const oldestDevice =
    deviceStarts.length > 0
      ? new Date(Math.min(...deviceStarts.map((d) => d.getTime())))
      : null;

  const campaignStart = parseDate(campaign.start_date);
  let start: Date | null;
  let startSource: PeriodStartSource;
  if (campaignStart) {
    start = campaignStart;
    startSource = 'campaign';
  } else if (oldestDevice) {
    start = oldestDevice;
    startSource = 'oldestDevice';
  } else {
    start = null;
    startSource = 'none';
  }

  let end: Date;
  let endSource: PeriodEndSource;
  const campaignEnd = parseDate(campaign.end_date);
  const allDevicesClosed =
    devices.length > 0 && devices.every((d) => parseDate(d.end_date) !== null);
  if (campaignEnd) {
    end = campaignEnd;
    endSource = 'campaign';
  } else if (allDevicesClosed) {
    end = new Date(
      Math.max(...devices.map((d) => parseDate(d.end_date)!.getTime()))
    );
    endSource = 'lastDevice';
  } else {
    end = now;
    endSource = 'today';
  }
  if (end.getTime() > now.getTime()) {
    end = now;
    endSource = 'today';
  }

  const earlierDeviceStart =
    start && oldestDevice && oldestDevice.getTime() < start.getTime()
      ? oldestDevice
      : null;

  return { start, end, startSource, endSource, earlierDeviceStart };
}
