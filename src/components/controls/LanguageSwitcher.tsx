import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLocale } from "../../i18n";
import { cn } from "../../lib/utils";

const DROPDOWN_OFFSET = 4;

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang = supportedLanguages.find((l) => l.code === i18n.language) ?? supportedLanguages[0];

  // Positionner le menu sous le bouton (en fixed pour le portal)
  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setDropdownRect(null);
      return;
    }
    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + DROPDOWN_OFFSET,
        left: rect.right - 112, // min-w-[7rem] = 112px, aligné à droite du bouton
      });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-language-listbox]")) setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: SupportedLocale) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  const dropdownContent =
    isOpen && dropdownRect && typeof document !== "undefined"
      ? createPortal(
          <ul
            data-language-listbox
            id="language-listbox"
            role="listbox"
            aria-labelledby="language-switcher"
            className="fixed z-[3000] min-w-[7rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: dropdownRect.top, left: dropdownRect.left }}
          >
            {supportedLanguages.map((lang) => (
              <li key={lang.code} role="option" aria-selected={i18n.language === lang.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={cn(
                    "w-full flex items-center px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    i18n.language === lang.code
                      ? "bg-[#4271B3]/10 text-[#4271B3]"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  title={lang.label}
                >
                  <span>{lang.label}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 rounded-lg border border-gray-200/80 px-2 py-1 text-xs font-semibold text-gray-700",
          "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3] transition-colors"
        )}
        aria-label={t("common.chooseLanguage")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="language-listbox"
        id="language-switcher"
        title={currentLang.label}
      >
        <span>{currentLang.label}</span>
        <svg
          className={cn("w-3.5 h-3.5 text-gray-500 transition-transform shrink-0", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownContent}
    </div>
  );
};

export default LanguageSwitcher;
