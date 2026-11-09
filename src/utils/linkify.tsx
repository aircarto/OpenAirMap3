import React from "react";

/**
 * Transforme les URLs d'un texte libre (commentaires/signalements) en liens
 * cliquables, en toute sécurité : on découpe la chaîne et on ne rend que des
 * nœuds React (jamais de `dangerouslySetInnerHTML`), donc pas de risque XSS.
 */

// URLs http(s):// ou www. (jusqu'au prochain espace)
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

// Retire la ponctuation de fin (fin de phrase) pour ne pas l'inclure dans le lien.
const stripTrailing = (url: string): [string, string] => {
  const m = url.match(/[.,;:!?)\]]+$/);
  if (!m) return [url, ""];
  return [url.slice(0, -m[0].length), m[0]];
};

export const linkify = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;

  while ((match = URL_RE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const [url, trailing] = stripTrailing(raw);
    const href = url.toLowerCase().startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-blue-600 underline break-all hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
};
