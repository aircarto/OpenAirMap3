import React from "react";
import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLocale } from "../../i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DropdownButton } from "./DropdownButton";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";

export interface LanguageSwitcherTriggerContext {
  /** Libellé de la langue courante, ex. « Français » */
  displayText: string;
  /** Code de locale en majuscules, ex. « FR » — seule forme tenant dans une caption */
  code: string;
}

type Props = Omit<CustomTriggerProps, "renderTrigger"> & {
  renderTrigger?: (context: LanguageSwitcherTriggerContext) => React.ReactNode;
};

/**
 * Sélecteur de langue.
 *
 * Bâti sur Radix `DropdownMenu` : l'implémentation précédente était un portail
 * fait main dont la position était calculée par `getBoundingClientRect`, avec un
 * `left: rect.right - 112` codé en dur qui supposait un alignement à droite —
 * dans un rail à gauche, le menu se serait posé par-dessus le rail. Radix gère
 * en plus le retour du focus au déclencheur et la fermeture par Échap, que
 * l'implémentation maison n'assurait pas.
 *
 * La sémantique passe de `listbox`/`option` à `menu`/`menuitemradio`, ce qui est
 * correct pour un déclencheur de menu et reste annoncé comme un choix unique.
 */
const LanguageSwitcher: React.FC<Props> = ({
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang =
    supportedLanguages.find((l) => l.code === i18n.language) ??
    supportedLanguages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({
            displayText: currentLang.label,
            code: currentLang.code.toUpperCase(),
          })
        ) : (
          <DropdownButton
            id="language-switcher"
            aria-label={t("common.chooseLanguage")}
            title={currentLang.label}
            size="compact"
            variant="minimal"
            chevronClassName="pr-1.5"
            className="pr-6 font-semibold text-gray-700"
          >
            <span className="block truncate pr-1">{currentLang.label}</span>
          </DropdownButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign ?? "end"}
        sideOffset={menuSideOffset}
        className={cn("min-w-[7rem]", menuClassName)}
      >
        <DropdownMenuRadioGroup
          value={i18n.language}
          onValueChange={(code) => i18n.changeLanguage(code as SupportedLocale)}
        >
          {supportedLanguages.map((lang) => (
            <DropdownMenuRadioItem
              key={lang.code}
              value={lang.code}
              className={cn(
                "py-2 pr-3 text-sm",
                i18n.language === lang.code && "bg-[#e7eef8] text-[#1f3c6d]"
              )}
            >
              {lang.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
