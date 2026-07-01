import React, { useEffect, useRef, useState } from "react";
import { Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import {
  Flame,
  Factory,
  Car,
  Home,
  MessageCircle,
  MessageSquare,
  Send,
  Loader2,
} from "lucide-react";
import { Signalement } from "../../types";
import {
  getStoredUser,
  setStoredUser,
  SIGNALEMENT_TYPES,
} from "../../constants/context";

// Tracés SVG (lucide) inlinés pour les marqueurs Leaflet — évite react-dom/server.
const ICON_PATHS: Record<string, string> = {
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  industrial:
    '<path d="M2 20a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1.6-.8L14 12V8a1 1 0 0 0-1.6-.8L6 12V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1Z"/><path d="M6 18h.01"/><path d="M10 18h.01"/><path d="M14 18h.01"/><path d="M18 18h.01"/>',
  traffic:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  neighbourhood:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  default: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  draft: '<path d="M5 12h14"/><path d="M12 5v14"/>',
};

// ── Style par type (composants lucide pour l'UI React des popups) ────────────
const TYPE_CONFIG: Record<string, { Icon: typeof Flame; color: string }> = {
  fire: { Icon: Flame, color: "#dc2626" },
  industrial: { Icon: Factory, color: "#64748b" },
  traffic: { Icon: Car, color: "#2563eb" },
  neighbourhood: { Icon: Home, color: "#16a34a" },
};
const DEFAULT_CONFIG = { Icon: MessageCircle, color: "#7c3aed" };

const configFor = (type: string | null) =>
  (type && TYPE_CONFIG[type]) || DEFAULT_CONFIG;

// Avatar (initiales + couleur déterministe)
const AVATAR_COLORS = [
  "#2563eb", "#0891b2", "#16a34a", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#0d9488",
];
const avatarColor = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const formatDate = (iso: string, locale: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── Icône de marqueur (pin goutte + icône lucide blanche) ────────────────────
const pinIcon = (type: string | null, count: number, isDraft = false): L.DivIcon => {
  const color = isDraft ? "#7c3aed" : configFor(type).color;
  const path = isDraft ? ICON_PATHS.draft : ICON_PATHS[type ?? "default"] || ICON_PATHS.default;
  const iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const badge =
    count > 1
      ? `<span style="position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;
            background:#fff;color:${color};border:1.5px solid ${color};border-radius:9999px;
            font-size:10px;line-height:13px;font-weight:700;text-align:center;">${count}</span>`
      : "";
  const html = `
    <div style="position:relative;width:34px;height:42px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));${
      isDraft ? "animation:oam-bounce .4s ease;" : ""
    }">
      <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 1 C8.2 1 1 8.2 1 17 C1 28 17 41 17 41 C17 41 33 28 33 17 C33 8.2 25.8 1 17 1 Z"
              fill="${color}" stroke="#ffffff" stroke-width="2" ${
                isDraft ? 'stroke-dasharray="3 2"' : ""
              }/>
      </svg>
      <div style="position:absolute;top:8px;left:9px;width:16px;height:16px;">${iconSvg}</div>
      ${badge}
    </div>`;
  return L.divIcon({
    html,
    className: "signalement-pin",
    iconSize: [34, 42],
    iconAnchor: [17, 41],
    popupAnchor: [0, -38],
  });
};

// ── Avatar + ligne de commentaire ────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 28 }) => (
  <div
    className="flex-shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
    style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.4 }}
  >
    {initials(name)}
  </div>
);

// ── Champ de saisie + bouton envoyer ─────────────────────────────────────────
const ReplyForm: React.FC<{
  posting: boolean;
  placeholder: string;
  onSubmit: (text: string, user: string) => Promise<void>;
}> = ({ posting, placeholder, onSubmit }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [user, setUser] = useState(getStoredUser());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || posting) return;
    const author = user.trim() || "anonymous";
    setStoredUser(author);
    try {
      await onSubmit(text.trim(), author);
      setText("");
    } catch {
      /* géré au-dessus */
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <input
        type="text"
        value={user}
        onChange={(e) => setUser(e.target.value)}
        placeholder={t("comments.namePlaceholder")}
        maxLength={100}
        className="w-full rounded-lg border border-gray-200 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
      />
      <div className="flex items-end gap-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          rows={1}
          className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 resize-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || posting}
          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
};

// ── Contenu du popup d'un signalement existant ───────────────────────────────
const SignalementPopupContent: React.FC<{
  signalement: Signalement;
  onReply: (sig: Signalement, text: string, user: string) => Promise<void>;
}> = ({ signalement, onReply }) => {
  const { t, i18n } = useTranslation();
  const [posting, setPosting] = useState(false);
  const { Icon, color } = configFor(signalement.contextType);

  const [root, ...replies] = signalement.comments;

  const handleReply = async (text: string, user: string) => {
    setPosting(true);
    try {
      await onReply(signalement, text, user);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="w-[340px] max-w-[84vw]">
      {/* ── Le signalement d'origine (bloc mis en avant) ── */}
      <div
        className="rounded-xl p-3 mb-3"
        style={{ backgroundColor: `${color}12`, borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-gray-900 truncate">
                {root?.user ?? "?"}
              </span>
              {signalement.contextType && (
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: color }}
                >
                  {t(`comments.types.${signalement.contextType}`)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500">
              {t("signalements.reportTag")} · {formatDate(root?.datetime ?? "", i18n.language)}
              {root?.id != null && (
                <span className="text-gray-400" title="ID">
                  {" "}
                  · #{root.id}
                </span>
              )}
            </span>
          </div>
        </div>
        {root?.comment && (
          <p className="text-[15px] leading-snug text-gray-800 whitespace-pre-line break-words">
            {root.comment}
          </p>
        )}
      </div>

      {/* ── Les réponses (section distincte) ── */}
      <div className="flex items-center gap-1.5 mb-2 text-gray-600">
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {t("signalements.repliesTitle")}
        </span>
        <span className="text-xs text-gray-400">{replies.length}</span>
      </div>

      {replies.length > 0 ? (
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1 mb-3">
          {replies.map((c, i) => (
            <div key={`${c.datetime}-${i}`} className="flex gap-2.5">
              <Avatar name={c.user} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{c.user}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 inline-flex items-center gap-1.5">
                    {c.id != null && (
                      <span className="text-gray-300" title="ID">
                        #{c.id}
                      </span>
                    )}
                    {formatDate(c.datetime, i18n.language)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line break-words">
                  {c.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">{t("signalements.noReplies")}</p>
      )}

      {/* ── Répondre ── */}
      <div className="pt-3 border-t border-gray-100">
        <ReplyForm
          posting={posting}
          placeholder={t("signalements.replyPlaceholder")}
          onSubmit={handleReply}
        />
      </div>
    </div>
  );
};

// <input type="datetime-local"> : instant présent en heure locale (YYYY-MM-DDTHH:MM)
const nowLocalInput = (): string => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

// datetime-local (heure locale) -> format API (UTC, sans ms), jamais dans le futur.
const localInputToApi = (value: string): string => {
  const now = new Date();
  const chosen = new Date(value);
  const d = isNaN(chosen.getTime()) || chosen > now ? now : chosen;
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
};

// ── Formulaire de création (brouillon) ───────────────────────────────────────
const DraftForm: React.FC<{
  onCreate: (
    text: string,
    user: string,
    type?: string,
    datetime?: string
  ) => Promise<void>;
  /** Remonte le type sélectionné pour l'aperçu live du marqueur */
  onTypeChange?: (type: string) => void;
}> = ({ onCreate, onTypeChange }) => {
  const { t } = useTranslation();
  const [type, setType] = useState<string>("");
  const [datetime, setDatetime] = useState<string>(nowLocalInput());
  const [posting, setPosting] = useState(false);

  // Sélection/désélection d'un type (toggle) + aperçu du marqueur en temps réel
  const chooseType = (tp: string) => {
    const next = type === tp ? "" : tp;
    setType(next);
    onTypeChange?.(next);
  };

  const handleCreate = async (text: string, user: string) => {
    setPosting(true);
    try {
      await onCreate(text, user, type || undefined, localInputToApi(datetime));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="w-[340px] max-w-[84vw]">
      <p className="text-base font-semibold text-gray-900 mb-1">
        {t("signalements.newTitle")}
      </p>
      <p className="text-xs text-gray-500 mb-2.5">{t("signalements.newHint")}</p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {SIGNALEMENT_TYPES.map((tp) => {
          const { Icon, color } = configFor(tp);
          const active = type === tp;
          return (
            <button
              key={tp}
              type="button"
              onClick={() => chooseType(tp)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-sm font-medium transition-colors"
              style={
                active
                  ? { backgroundColor: `${color}14`, borderColor: color, color }
                  : { borderColor: "#e5e7eb", color: "#4b5563" }
              }
            >
              <Icon className="w-4 h-4" />
              {t(`comments.types.${tp}`)}
            </button>
          );
        })}
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t("signalements.datetimeLabel")}
        </label>
        <input
          type="datetime-local"
          value={datetime}
          max={nowLocalInput()}
          onChange={(e) => setDatetime(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
        />
      </div>

      <ReplyForm
        posting={posting}
        placeholder={t("signalements.placeholder")}
        onSubmit={handleCreate}
      />
    </div>
  );
};

// ── Capture du clic droit ────────────────────────────────────────────────────
export const SignalementRightClickHandler: React.FC<{
  onContextMenu: (lat: number, lon: number) => void;
  disabled?: boolean;
}> = ({ onContextMenu, disabled }) => {
  useMapEvents({
    contextmenu: (e) => {
      if (disabled) return;
      e.originalEvent.preventDefault();
      onContextMenu(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// ── Marqueur de brouillon (popup ouvert automatiquement) ─────────────────────
const DraftMarker: React.FC<{
  lat: number;
  lon: number;
  onCreate: (
    text: string,
    user: string,
    type?: string,
    datetime?: string
  ) => Promise<void>;
  onCancel: () => void;
}> = ({ lat, lon, onCreate, onCancel }) => {
  const markerRef = useRef<L.Marker>(null);
  // Type sélectionné dans le formulaire → aperçu du marqueur avant envoi.
  // Vide = pin « brouillon » (violet, +), sinon pin coloré/typé du signalement.
  const [previewType, setPreviewType] = useState<string>("");
  useEffect(() => {
    markerRef.current?.openPopup();
  }, [lat, lon]);
  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={pinIcon(previewType || null, 0, !previewType)}
      zIndexOffset={1000}
      eventHandlers={{ popupclose: onCancel }}
    >
      <Popup minWidth={340} maxWidth={360} closeButton autoClose={false} closeOnClick={false}>
        <DraftForm onCreate={onCreate} onTypeChange={setPreviewType} />
      </Popup>
    </Marker>
  );
};

// ── Composant principal ──────────────────────────────────────────────────────
interface SignalementMarkersProps {
  signalements: Signalement[];
  draft: { lat: number; lon: number } | null;
  onReply: (sig: Signalement, text: string, user: string) => Promise<void>;
  onCreate: (
    text: string,
    user: string,
    type?: string,
    datetime?: string
  ) => Promise<void>;
  onCancelDraft: () => void;
}

const SignalementMarkers: React.FC<SignalementMarkersProps> = ({
  signalements,
  draft,
  onReply,
  onCreate,
  onCancelDraft,
}) => {
  return (
    <>
      {signalements.map((s) => (
        <Marker
          key={`sig-${s.id}`}
          position={[s.lat, s.lon]}
          icon={pinIcon(s.contextType, s.comments.length)}
          zIndexOffset={400}
        >
          <Popup minWidth={340} maxWidth={360}>
            <SignalementPopupContent signalement={s} onReply={onReply} />
          </Popup>
        </Marker>
      ))}

      {draft && (
        <DraftMarker
          lat={draft.lat}
          lon={draft.lon}
          onCreate={onCreate}
          onCancel={onCancelDraft}
        />
      )}
    </>
  );
};

export default SignalementMarkers;
