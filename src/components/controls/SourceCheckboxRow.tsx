import React, { useId } from "react";
import { Checkbox } from "../ui/checkbox";
import { cn } from "../../lib/utils";

export interface SourceCheckboxRowProps {
  /** Sert au `data-testid` par défaut (`source-${code}`) */
  code: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  indented?: boolean;
  /** Apparence grisée (mode mobilité) tout en restant cliquable */
  muted?: boolean;
  /** Réellement inactif (pas de temps incompatible) */
  disabled?: boolean;
  /** Pictogramme placé avant le libellé (ex. marqueur SignalAir) */
  icon?: React.ReactNode;
  testId?: string;
}

/**
 * Ligne de source cochable.
 *
 * Un `Checkbox` et une étiquette liée par `htmlFor`, et non un
 * `DropdownMenuCheckboxItem` : celui-ci **ferme le menu à chaque cochage**.
 * Vérifié dans `@radix-ui/react-menu` — `MenuItem.handleSelect` appelle
 * `rootContext.onClose()` dès que l'événement de sélection n'est pas prévenu, et
 * `MenuCheckboxItem` compose son `onSelect` sans le prévenir. Sur un menu à choix
 * multiple, cocher deux sources demandait donc deux réouvertures ; et lorsque la
 * source était incompatible avec le pas de temps courant, le clic fermait le
 * menu, affichait un toast et ne changeait rien.
 *
 * Partagée par les sources de mesure et par les types SignalAir, pour que le
 * menu Sources n'ait qu'un seul modèle de ligne.
 */
export const SourceCheckboxRow: React.FC<SourceCheckboxRowProps> = ({
  code,
  label,
  checked,
  onToggle,
  indented = false,
  muted = false,
  disabled = false,
  icon,
  testId,
}) => {
  const id = useId();

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors",
        indented && "ml-4",
        (muted || disabled) && "opacity-50",
        checked && !muted && !disabled
          ? "bg-[#e7eef8]"
          : !disabled && "hover:bg-black/[0.04]"
      )}
    >
      <Checkbox
        id={id}
        data-testid={testId ?? `source-${code}`}
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-disabled={muted || undefined}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex flex-1 items-center gap-2 text-sm",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          muted || disabled
            ? "text-gray-500"
            : checked
              ? "text-[#1f3c6d]"
              : "text-gray-700"
        )}
      >
        {icon}
        <span>{label}</span>
      </label>
    </div>
  );
};

export default SourceCheckboxRow;
