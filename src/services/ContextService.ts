import { ContextComment, Signalement } from "../types";

/**
 * Accès à l'API « context » (api.aircarto.fr/context) : commentaires attachés
 * à un sujet (capteur / bateau / zone) et signalements géolocalisés.
 *
 * - Lecture/écriture d'un fil de commentaires : mode « capteur » (capteur_id =
 *   identifiant du sujet, geoloc=false).
 * - Signalements GPS : mode « geoloc » (geoloc=true, lat/long, capteur_id =
 *   identifiant du fil de signalement).
 *
 * N'écrit jamais en base directement : tout passe par les endpoints existants.
 */

interface RawContextRow {
  id?: number | null;
  capteur_id?: string | null;
  datetime_start?: string;
  datetime_stop?: string;
  context_type?: string | null;
  user?: string | null;
  comments?: string | null;
  lat?: number;
  long?: number;
}

/** Horodatage courant au format accepté par l'API (sans millisecondes) */
const nowApiFormat = (): string =>
  new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const rowToComment = (row: RawContextRow): ContextComment => ({
  id: row.id ?? null,
  user: (row.user || "anonymous").trim() || "anonymous",
  comment: (row.comments || "").trim(),
  contextType: row.context_type || null,
  datetime: row.datetime_start || "",
});

const byDateAsc = (a: ContextComment, b: ContextComment): number =>
  new Date(a.datetime).getTime() - new Date(b.datetime).getTime();

export class ContextService {
  private readonly baseUrl = import.meta.env.DEV
    ? "/aircarto/context"
    : "https://api.aircarto.fr/context";

  // ── Lecture ────────────────────────────────────────────────────────────

  /** Fil de commentaires d'un sujet (capteur / bateau / zone) */
  async getThread(subjectId: string): Promise<ContextComment[]> {
    const url = `${this.baseUrl}/get_context?capteur_id=${encodeURIComponent(
      subjectId
    )}`;
    const rows = await this.fetchJson(url);
    if (!Array.isArray(rows)) return [];
    return rows.map(rowToComment).sort(byDateAsc);
  }

  /** Tous les signalements GPS, regroupés par fil */
  async getSignalements(): Promise<Signalement[]> {
    const url = `${this.baseUrl}/get_context?geoloc=true`;
    const rows = await this.fetchJson(url);
    if (!Array.isArray(rows)) return [];

    const groups = new Map<string, Signalement>();
    for (const row of rows as RawContextRow[]) {
      if (row.lat == null || row.long == null) continue;
      // Les lignes sans id (anciennes) forment chacune leur propre fil
      const id = row.capteur_id || `legacy-${row.lat},${row.long}-${row.datetime_start}`;
      let sig = groups.get(id);
      if (!sig) {
        sig = {
          id,
          lat: Number(row.lat),
          lon: Number(row.long),
          contextType: row.context_type || null,
          comments: [],
        };
        groups.set(id, sig);
      }
      sig.comments.push(rowToComment(row));
    }

    return [...groups.values()].map((sig) => {
      sig.comments.sort(byDateAsc);
      // Type et position = ceux du commentaire d'origine (le plus ancien)
      sig.contextType = sig.comments[0]?.contextType ?? sig.contextType;
      return sig;
    });
  }

  // ── Écriture ───────────────────────────────────────────────────────────

  /** Ajoute un commentaire à un sujet (capteur / bateau / zone) */
  async postComment(params: {
    subjectId: string;
    comment: string;
    user: string;
    type?: string;
  }): Promise<void> {
    const now = nowApiFormat();
    await this.postJson("/post_context", {
      capteur_id: params.subjectId,
      datetime_start: now,
      datetime_end: now,
      context_type: params.type ?? "",
      comments: params.comment,
      user: params.user || "anonymous",
    });
  }

  /** Crée un signalement GPS, ou y ajoute une réponse (même `id`) */
  async postSignalement(params: {
    id: string;
    lat: number;
    lon: number;
    comment: string;
    user: string;
    type?: string;
    /** Horodatage de l'événement (format API). Défaut = maintenant. */
    datetime?: string;
  }): Promise<void> {
    const when = params.datetime || nowApiFormat();
    await this.postJson("/post_context", {
      geoloc: true,
      capteur_id: params.id,
      lat: params.lat,
      long: params.lon,
      datetime_start: when,
      datetime_end: when,
      context_type: params.type ?? "",
      comments: params.comment,
      user: params.user || "anonymous",
    });
  }

  // ── Bas niveau ─────────────────────────────────────────────────────────

  private async fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Context API: HTTP ${response.status}`);
    }
    return response.json();
  }

  private async postJson(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        /* garder le message générique */
      }
      throw new Error(message);
    }
  }
}
