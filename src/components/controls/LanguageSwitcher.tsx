'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/navigation';
import { supportedLanguages, type SupportedLocale } from '../../i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { DropdownButton } from './DropdownButton';
import type { CustomTriggerProps } from './dropdownTriggerContract';
import { cn } from '../../lib/utils';

export interface LanguageSwitcherTriggerContext {
  displayText: string;
  code: string;
}

type Props = Omit<CustomTriggerProps, 'renderTrigger'> & {
  renderTrigger?: (context: LanguageSwitcherTriggerContext) => React.ReactNode;
};

/**
 * Sélecteur de langue : navigue vers le pathname localisé (next-intl),
 * ce qui rend la langue crawlable (préfixe d'URL).
 */
const LanguageSwitcher: React.FC<Props> = ({
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const t = useTranslations('common');
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();
  const currentLang =
    supportedLanguages.find((l) => l.code === locale) ?? supportedLanguages[0];

  const switchLocale = (code: string) => {
    const next = code as SupportedLocale;
    if (next === locale) return;
    const search =
      typeof window !== 'undefined' ? window.location.search : '';
    router.replace(pathname, { locale: next });
    if (search) {
      requestAnimationFrame(() => {
        if (window.location.search !== search) {
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${search}`
          );
        }
      });
    }
  };

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
            aria-label={t('chooseLanguage')}
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
        align={menuAlign ?? 'end'}
        sideOffset={menuSideOffset}
        className={cn('min-w-[7rem]', menuClassName)}
      >
        <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
          {supportedLanguages.map((lang) => (
            <DropdownMenuRadioItem
              key={lang.code}
              value={lang.code}
              className={cn(
                'py-2 pr-3 text-sm',
                locale === lang.code && 'bg-[#e7eef8] text-[#1f3c6d]'
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
