import React from "react";
import "flag-icons/css/flag-icons.min.css";

interface FlagProps {
  /** Code pays ISO 3166-1 alpha-2 (ex: "FR") */
  iso?: string | null;
  className?: string;
  title?: string;
}

/**
 * Drapeau pays via la librairie flag-icons (vrais SVG, rendu identique partout
 * — contrairement aux emojis drapeaux qui ne s'affichent pas sous Windows).
 * La taille suit la taille de police du parent (.fi = 1.33em de large).
 */
const Flag: React.FC<FlagProps> = ({ iso, className, title }) => {
  if (!iso) return null;
  return (
    <span
      className={`fi fi-${iso.toLowerCase()} rounded-[2px] shadow-sm ${className ?? ""}`.trim()}
      title={title}
      aria-label={iso.toUpperCase()}
      role="img"
    />
  );
};

export default Flag;
