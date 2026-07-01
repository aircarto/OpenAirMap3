import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { ContextComment } from "../types";
import { getStoredUser, setStoredUser } from "../constants/context";
import { linkify } from "../utils/linkify";

interface CommentsThreadProps {
  comments: ContextComment[];
  loading?: boolean;
  posting?: boolean;
  error?: string | null;
  onAdd: (comment: string, user: string) => Promise<void> | void;
}

/** Couleur d'avatar déterministe à partir du nom */
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
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * Fil de commentaires réutilisable (capteur / bateau / zone) : liste soignée +
 * formulaire d'ajout. Design carte + avatars, icônes lucide.
 */
const CommentsThread: React.FC<CommentsThreadProps> = ({
  comments,
  loading,
  posting,
  error,
  onAdd,
}) => {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState("");
  const [user, setUser] = useState(getStoredUser());

  const formatDate = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || posting) return;
    const author = user.trim() || "anonymous";
    setStoredUser(author);
    try {
      await onAdd(text.trim(), author);
      setText("");
    } catch {
      /* géré par le parent */
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-gray-700">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm font-semibold">{t("comments.title")}</span>
        {comments.length > 0 && (
          <span className="text-xs text-gray-400">{comments.length}</span>
        )}
      </div>

      {/* Liste */}
      {loading && comments.length === 0 ? (
        <p className="text-sm text-gray-400">{t("comments.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">{t("comments.empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c, i) => (
            <li key={`${c.datetime}-${i}`} className="flex gap-2.5">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                style={{ backgroundColor: avatarColor(c.user) }}
              >
                {initials(c.user)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {c.user}
                  </span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 inline-flex items-center gap-1.5">
                    {c.id != null && (
                      <span className="text-gray-300" title="ID">
                        #{c.id}
                      </span>
                    )}
                    {formatDate(c.datetime)}
                  </span>
                </div>
                {c.comment && (
                  <p className="text-sm text-gray-700 whitespace-pre-line break-words">
                    {linkify(c.comment)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder={t("comments.namePlaceholder")}
          maxLength={100}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400"
        />
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("comments.placeholder")}
            maxLength={1000}
            rows={1}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 resize-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || posting}
            className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={t("comments.submit")}
          >
            {posting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{t("comments.postError")}</p>}
      </form>
    </div>
  );
};

export default CommentsThread;
