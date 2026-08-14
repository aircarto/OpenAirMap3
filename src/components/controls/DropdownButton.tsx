import React from "react";
import { cn } from "../../lib/utils";

export type DropdownButtonVariant =
  | "minimal"
  | "elegant"
  | "soft"
  | "modern"
  | "glass"
  | "disabled";

export interface DropdownButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DropdownButtonVariant;
  size?: "default" | "compact";
  /** Masque le chevron (état désactivé, ou déclencheur purement iconographique) */
  hideChevron?: boolean;
  /** Classes additionnelles sur le conteneur du chevron (largeur, padding) */
  chevronClassName?: string;
}

// Variantes de style pour les boutons dropdown
const variants: Record<
  DropdownButtonVariant,
  { base: string; icon: string }
> = {
  minimal: {
    base: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
    icon: "text-gray-500",
  },
  elegant: {
    base: "bg-gradient-to-br from-gray-50 to-white border border-gray-200/60 text-gray-800 hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 shadow-sm backdrop-blur-sm",
    icon: "text-gray-600",
  },
  soft: {
    base: "bg-[#f8f9fa] border border-gray-200 text-gray-800 hover:bg-[#eef1f3] hover:border-[#4271B3]/30 shadow-sm",
    icon: "text-gray-600",
  },
  modern: {
    base: "bg-white/80 backdrop-blur-md border border-gray-200/50 text-gray-800 hover:bg-white hover:border-[#4271B3]/40 hover:shadow-md transition-all duration-200 shadow-sm",
    icon: "text-gray-600",
  },
  // Surface « verre dépoli » du rail de contrôles — les tokens sont définis dans index.css
  glass: {
    base: "glass-1 text-[color:var(--fg)] hover:bg-white/10",
    icon: "text-[color:var(--fg-muted)]",
  },
  disabled: {
    base: "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed shadow-sm",
    icon: "text-gray-400",
  },
};

const sizes = {
  default: "pl-3 pr-7 py-2 text-sm",
  compact: "px-2 py-1.5 text-xs",
};

/**
 * Déclencheur commun des menus déroulants.
 *
 * Doit rester un `forwardRef` qui diffuse ses props : Radix `<DropdownMenuTrigger asChild>`
 * clone son enfant en y injectant `ref`, `onPointerDown`, `aria-expanded`, `aria-haspopup`
 * et `data-state`. Sans cette diffusion, les menus cessent silencieusement de s'ouvrir.
 *
 * Le contenu est rendu tel quel (pas d'enveloppe implicite) pour que chaque appelant garde
 * la maîtrise de sa troncature et de sa mise en page interne.
 */
export const DropdownButton = React.forwardRef<
  HTMLButtonElement,
  DropdownButtonProps
>(
  (
    {
      children,
      className,
      chevronClassName,
      variant = "elegant",
      size = "default",
      hideChevron = false,
      type = "button",
      ...props
    },
    ref
  ) => {
    const variantStyles = variants[variant];

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative rounded-lg text-left font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3]",
          sizes[size],
          variantStyles.base,
          className
        )}
        {...props}
      >
        {children}
        {!hideChevron && (
          <span
            className={cn(
              "absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none",
              variantStyles.icon,
              chevronClassName
            )}
          >
            <svg
              className="h-4 w-4 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        )}
      </button>
    );
  }
);

DropdownButton.displayName = "DropdownButton";

export default DropdownButton;
