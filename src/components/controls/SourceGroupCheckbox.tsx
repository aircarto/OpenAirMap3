import React, { useId } from "react";
import { Checkbox } from "../ui/checkbox";

export interface SourceGroupCheckboxProps {
  label: string;
  /** Codes de sources que la case pilote — voir COMMUNAUTAIRE_SOURCE_CODES */
  scope: string[];
  selectedSources: string[];
  onToggle: () => void;
  /** Résumé `n/total`, sans quoi « tout coché » sur un périmètre partiel se lit comme un bug */
  hint?: string;
  testId?: string;
}

/**
 * Case « tout cocher » d'un groupe de sources, à trois états.
 *
 * Remplace `CommunautaireGroupCheckbox`, dont trois défauts étaient observables
 * dans le DOM rendu :
 *
 * 1. L'état indéterminé était posé en impératif — `setAttribute("data-state",
 *    "indeterminate")` dans un effet — par-dessus l'attribut piloté par Radix,
 *    qui recevait un `checked` booléen. La course était perdue d'avance, et
 *    surtout `aria-checked` restait à `"false"` : un lecteur d'écran annonçait
 *    « non coché » sur un groupe partiellement sélectionné. L'API `checked`
 *    de Radix accepte `"indeterminate"` et produit `aria-checked="mixed"`.
 * 2. Un `<div role="button" tabIndex={0}>` enveloppait un vrai
 *    `role="checkbox"` : deux éléments interactifs imbriqués, et `onToggle`
 *    branché à la fois sur le wrapper et sur `onCheckedChange`, donc tiré deux
 *    fois pour un clic sur la case.
 * 3. Ce `tabIndex={0}` créait un second arrêt de tabulation À L'INTÉRIEUR d'un
 *    `role="menu"` dont tous les items sont en `tabIndex={-1}`, cassant le
 *    modèle de focus du menu.
 *
 * Ici : un seul élément interactif, et l'étiquette cliquable par `htmlFor`
 * plutôt que par imbrication.
 */
export const SourceGroupCheckbox: React.FC<SourceGroupCheckboxProps> = ({
  label,
  scope,
  selectedSources,
  onToggle,
  hint,
  testId,
}) => {
  const id = useId();
  const selectedCount = scope.filter((code) =>
    selectedSources.includes(code)
  ).length;

  const checked: boolean | "indeterminate" =
    selectedCount === 0
      ? false
      : selectedCount === scope.length
        ? true
        : "indeterminate";

  return (
    <div className="flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-black/[0.04]">
      <Checkbox
        id={id}
        data-testid={testId}
        checked={checked}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={id}
        className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-gray-700"
      >
        <span className="flex-1 font-medium">{label}</span>
        {hint && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-60">
            {hint}
          </span>
        )}
      </label>
    </div>
  );
};

export default SourceGroupCheckbox;
