import type React from "react";

export type NoticeTone = "info" | "warn" | "error" | "neutral";

export interface Notice {
  /** Identifiant stable : sert de clé de rendu et de déduplication */
  id: string;
  tone: NoticeTone;
  message: React.ReactNode;
  /** Contenu secondaire, rendu en plus petit sous le message */
  detail?: React.ReactNode;
  /** Affiche un indicateur d'activité (chargement en cours) */
  busy?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
}

/** Retire les entrées absentes, pour composer une liste par simple concaténation */
export const compactNotices = (
  notices: Array<Notice | null | false | undefined>
): Notice[] => notices.filter((n): n is Notice => Boolean(n));
