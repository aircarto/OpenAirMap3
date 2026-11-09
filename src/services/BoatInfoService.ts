/**
 * Enrichissement des fiches bateau via Wikidata + Wikimedia Commons.
 *
 * Source 100 % gratuite, sans clé, CORS ouvert (`Access-Control-Allow-Origin: *`).
 * À partir du numéro IMO du navire (déjà présent dans nos données AIS), on
 * interroge le point SPARQL public de Wikidata pour récupérer une photo libre
 * (Wikimedia Commons) et le lien Wikipédia. Couvre surtout les navires
 * « notables » : ferries, paquebots, cargos connus (les petits bateaux de
 * plaisance / pêche n'y sont pas → on retombe sur les liens externes du panel).
 *
 * Aucune écriture, aucune donnée sensible : simple lecture publique.
 */

export interface BoatExternalInfo {
  /** URL d'une vignette prête pour une balise <img> (largeur bornée) */
  photoThumbUrl: string | null;
  /** Page descriptive Commons (licence + auteur) pour créditer la photo */
  photoCreditUrl: string | null;
  /** Article Wikipédia (langue de l'UI si dispo, sinon anglais) */
  wikipediaUrl: string | null;
  /** Fiche Wikidata du navire */
  wikidataUrl: string | null;
}

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

export class BoatInfoService {
  // Cache mémoire par IMO : une même fiche n'est interrogée qu'une fois
  // par session (clé = `${imo}|${lang}`).
  private static cache = new Map<string, BoatExternalInfo | null>();

  async fetchByImo(
    imo: number,
    lang: string
  ): Promise<BoatExternalInfo | null> {
    const cacheKey = `${imo}|${lang}`;
    if (BoatInfoService.cache.has(cacheKey)) {
      return BoatInfoService.cache.get(cacheKey) ?? null;
    }

    try {
      const result = await this.queryWikidata(imo, lang);
      BoatInfoService.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      // Les photos sont un bonus : en cas d'échec (réseau, rate-limit
      // Wikidata...), on ne bloque rien — le panel reste fonctionnel.
      console.debug("[BoatInfo] Wikidata indisponible pour IMO", imo, error);
      // On ne met pas l'échec en cache : un nouveau clic pourra réessayer.
      return null;
    }
  }

  private async queryWikidata(
    imo: number,
    lang: string
  ): Promise<BoatExternalInfo | null> {
    // IMO injecté comme entier validé (jamais une chaîne libre) -> pas d'injection
    const safeImo = Math.trunc(imo);
    const sparql = `SELECT ?item ?image ?articleFr ?articleEn ?articleLang WHERE {
  ?item wdt:P458 "${safeImo}" .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?articleFr schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> . }
  OPTIONAL { ?articleEn schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?articleLang schema:about ?item ; schema:isPartOf <https://${lang}.wikipedia.org/> . }
} LIMIT 1`;

    const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(
      sparql
    )}`;

    const response = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Wikidata HTTP ${response.status}`);
    }

    const data = await response.json();
    const binding = data?.results?.bindings?.[0];
    if (!binding) {
      return null;
    }

    const imageValue: string | undefined = binding.image?.value;
    const wikidataUrl: string | undefined = binding.item?.value;
    const wikipediaUrl: string | null =
      binding.articleLang?.value ||
      binding.articleFr?.value ||
      binding.articleEn?.value ||
      null;

    // Aucune info exploitable -> considérer comme "pas de fiche"
    if (!imageValue && !wikipediaUrl) {
      return null;
    }

    return {
      photoThumbUrl: imageValue ? this.toThumbUrl(imageValue) : null,
      photoCreditUrl: imageValue ? this.toCommonsFilePage(imageValue) : null,
      wikipediaUrl,
      wikidataUrl: wikidataUrl ? wikidataUrl.replace(/^http:/, "https:") : null,
    };
  }

  /**
   * Convertit l'URL P18 (`.../Special:FilePath/<fichier>`) en vignette bornée
   * en largeur (évite de charger une photo pleine résolution dans le panel).
   */
  private toThumbUrl(imageValue: string): string {
    const https = imageValue.replace(/^http:/, "https:");
    const separator = https.includes("?") ? "&" : "?";
    return `${https}${separator}width=480`;
  }

  /** Page descriptive Commons (licence/auteur) pour créditer la photo */
  private toCommonsFilePage(imageValue: string): string | null {
    const match = imageValue.match(/Special:FilePath\/(.+)$/);
    if (!match) {
      return null;
    }
    const fileName = match[1].split("?")[0];
    return `https://commons.wikimedia.org/wiki/File:${fileName}`;
  }
}
