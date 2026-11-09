/**
 * Enrichissement des fiches zones (aéroport / port / Seveso) : photo +
 * description, à partir des étiquettes OpenStreetMap `wikipedia` / `wikidata`
 * déjà stockées dans les GeoJSON.
 *
 * Sources 100 % gratuites, sans clé, CORS ouvert :
 *  - API REST Wikipédia (résumé) : titre + extrait + vignette
 *  - Wikidata (EntityData)       : image (P18) + lien, en repli
 */

export interface ZoneExternalInfo {
  photoUrl: string | null;
  /** Page de crédit (article Wikipédia ou fiche Commons) */
  photoCreditUrl: string | null;
  /** Court résumé descriptif */
  extract: string | null;
  wikipediaUrl: string | null;
  title: string | null;
}

interface ZoneWikiTags {
  wikipedia?: string; // ex: "fr:Aéroport de Toulon-Hyères"
  wikidata?: string; // ex: "Q543189"
}

export class ZoneInfoService {
  private static cache = new Map<string, ZoneExternalInfo | null>();

  async fetch(tags: ZoneWikiTags): Promise<ZoneExternalInfo | null> {
    const key = tags.wikipedia || tags.wikidata;
    if (!key) {
      return null;
    }
    if (ZoneInfoService.cache.has(key)) {
      return ZoneInfoService.cache.get(key) ?? null;
    }

    try {
      let info: ZoneExternalInfo | null = null;
      if (tags.wikipedia) {
        info = await this.fromWikipediaTag(tags.wikipedia);
      }
      if (!info && tags.wikidata) {
        info = await this.fromWikidata(tags.wikidata);
      }
      ZoneInfoService.cache.set(key, info);
      return info;
    } catch (error) {
      console.debug("[ZoneInfo] indisponible pour", key, error);
      return null; // bonus : ne jamais bloquer le panel
    }
  }

  /** Étiquette OSM "lang:Titre" -> résumé Wikipédia (titre + extrait + photo) */
  private async fromWikipediaTag(tag: string): Promise<ZoneExternalInfo | null> {
    const sep = tag.indexOf(":");
    const lang = sep > 0 ? tag.slice(0, sep) : "fr";
    const title = sep > 0 ? tag.slice(sep + 1) : tag;

    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title
    )}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    const d = await response.json();
    const page = d?.content_urls?.desktop?.page ?? null;
    return {
      photoUrl: d?.thumbnail?.source ?? d?.originalimage?.source ?? null,
      photoCreditUrl: page,
      extract: d?.extract ?? null,
      wikipediaUrl: page,
      title: d?.title ?? title,
    };
  }

  /** Identifiant Wikidata -> image (P18) + lien Wikipédia, en repli */
  private async fromWikidata(id: string): Promise<ZoneExternalInfo | null> {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(
      id
    )}.json`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    const d = await response.json();
    const entity = d?.entities?.[id];
    if (!entity) {
      return null;
    }

    const fileName: string | undefined =
      entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const photoUrl = fileName
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
          fileName
        )}?width=480`
      : null;
    const photoCreditUrl = fileName
      ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`
      : null;

    const sitelink = entity.sitelinks?.frwiki || entity.sitelinks?.enwiki;
    const wikipediaUrl =
      sitelink?.url ||
      (sitelink?.title
        ? `https://${
            entity.sitelinks?.frwiki ? "fr" : "en"
          }.wikipedia.org/wiki/${encodeURIComponent(sitelink.title)}`
        : null);

    if (!photoUrl && !wikipediaUrl) {
      return null;
    }
    return {
      photoUrl,
      photoCreditUrl,
      extract: null,
      wikipediaUrl,
      title: sitelink?.title ?? null,
    };
  }
}
