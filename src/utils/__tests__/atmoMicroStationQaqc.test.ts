import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildQaqcLocationIdSet,
  getLegacySiteQaqcExclusionReason,
  getQaqcLocationMatchReason,
  hasRefStationCode,
  locationIdsFromStationIdSites,
  normalizePlaceName,
  normalizeStationIdSite,
  findNearbyRefStation,
  resetQaqcStationsCache,
  QAQC_STATION_PROXIMITY_M,
} from '../atmoMicroStationQaqc';

describe('atmoMicroStationQaqc', () => {
  beforeEach(() => {
    resetQaqcStationsCache();
  });

  it('normalise les noms de lieux', () => {
    expect(normalizePlaceName('Marseille_Longchamp')).toBe('marseille longchamp');
    expect(normalizePlaceName('Nice Magnan FR24035')).toBe('nice magnan fr24035');
  });

  it('normalise id_site AtmoRef', () => {
    expect(normalizeStationIdSite(29)).toBe('29');
    expect(normalizeStationIdSite('59')).toBe('59');
    expect(normalizeStationIdSite(' 11 ')).toBe('11');
    expect(normalizeStationIdSite(null)).toBeNull();
    expect(normalizeStationIdSite('')).toBeNull();
  });

  it('détecte un code station FRxxxxx', () => {
    expect(hasRefStationCode('FR24035')).toBe(true);
    expect(hasRefStationCode('Nice Magnan FR24035')).toBe(true);
    expect(hasRefStationCode('13')).toBe(false);
    expect(hasRefStationCode(null)).toBe(false);
  });

  it('trouve une station dans le rayon de proximité', () => {
    const stations = [
      {
        id: 'FR03030',
        name: 'Gardanne',
        latitude: 43.453584,
        longitude: 5.466672,
        idSite: null,
      },
    ];

    expect(
      findNearbyRefStation(43.453584, 5.466672, stations)?.id
    ).toBe('FR03030');
    expect(
      findNearbyRefStation(43.5, 5.5, stations, QAQC_STATION_PROXIMITY_M)
    ).toBeNull();
  });

  it('priorité : location_id depuis id_site AtmoRef, sans dépendre des locations', () => {
    const fromIdSite = locationIdsFromStationIdSites([
      {
        id: 'FR03030',
        name: 'Gardanne',
        latitude: 43.453584,
        longitude: 5.466672,
        idSite: '29',
      },
      {
        id: 'FR03080',
        name: 'Avignon Mairie',
        latitude: null,
        longitude: null,
        idSite: '11',
      },
      {
        id: 'FR00008',
        name: 'Sans co-location',
        latitude: 43.3,
        longitude: 5.3,
        idSite: null,
      },
    ]);

    expect([...fromIdSite].sort()).toEqual(['11', '29']);
  });

  it('buildQaqcLocationIdSet : id_site + repli heuristique', () => {
    const stations = [
      {
        id: 'FR03030',
        name: 'Gardanne',
        latitude: 43.453584,
        longitude: 5.466672,
        idSite: '29',
      },
      {
        id: 'FR24035',
        name: 'Nice Promenade des Anglais',
        latitude: 43.6893,
        longitude: 7.2421,
        // Pas encore d'id_site : le repli FRxxxxx / proximité couvre
        idSite: null,
      },
    ];

    const locationIds = buildQaqcLocationIdSet(
      [
        {
          id: '29',
          name: 'Gardanne',
          lat: 43.453584,
          lon: 5.466672,
        },
        {
          id: '59',
          name: 'Nice Magnan FR24035',
          lat: 43.6893,
          lon: 7.2421,
        },
        {
          id: '103',
          name: 'Meyreuil Fauvettes',
          lat: 43.4757,
          lon: 5.4971,
        },
      ],
      stations
    );

    expect([...locationIds].sort()).toEqual(['29', '59']);
  });

  it('match location : code FR dans le nom', () => {
    expect(
      getQaqcLocationMatchReason(
        { id: '23', name: 'Contes FR24023', lat: 43.78, lon: 7.33 },
        []
      )
    ).toBe('nom contient code station FRxxxxx');
  });

  it('match location : nom identique', () => {
    expect(
      getQaqcLocationMatchReason(
        {
          id: '40',
          name: 'Marseille Longchamp',
          lat: 43.3,
          lon: 5.4,
        },
        [
          {
            id: 'FR03043',
            name: 'Marseille_Longchamp',
            latitude: 43.305287,
            longitude: 5.394716,
            idSite: null,
          },
        ]
      )
    ).toBe('nom identique a une station AtmoRef');
  });

  it('match location : proximité', () => {
    expect(
      getQaqcLocationMatchReason(
        {
          id: '2097',
          name: 'Briançon_AncienneEcoleDuProrel',
          lat: 44.897977,
          lon: 6.630613,
        },
        [
          {
            id: 'FR00041',
            name: 'Briançon - Prorel',
            latitude: 44.897977,
            longitude: 6.630613,
            idSite: null,
          },
        ]
      )
    ).toBe('proximite station AtmoRef');
  });

  it('repli ancienne API : code_station_commun', () => {
    expect(
      getLegacySiteQaqcExclusionReason({
        lat: 44.5,
        lon: 6.0,
        locationName: 'Gap',
        codeStationCommun: 'FR24033',
        stations: [],
      })
    ).toBe('code_station_commun FRxxxxx');
  });

  it('ne filtre pas un site terrain hors station', () => {
    expect(
      getQaqcLocationMatchReason(
        {
          id: '103',
          name: 'Meyreuil Fauvettes',
          lat: 43.4757,
          lon: 5.4971,
        },
        [
          {
            id: 'FR03030',
            name: 'Gardanne',
            latitude: 43.453584,
            longitude: 5.466672,
            idSite: null,
          },
        ]
      )
    ).toBeNull();
  });
});
