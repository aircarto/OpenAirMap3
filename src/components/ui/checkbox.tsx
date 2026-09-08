import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cn } from "../../lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded border border-gray-300 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#325a96] data-[state=checked]:border-[#325a96] data-[state=checked]:text-white data-[state=indeterminate]:bg-[#d0def4] data-[state=indeterminate]:border-[#adc4e6] data-[state=indeterminate]:text-[#325a96] relative",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      {/*
        L'indicateur Radix est monté pour `checked` ET pour `"indeterminate"` :
        sans cette distinction, un groupe partiellement coché afficherait une
        coche pleine. Le trait était auparavant dessiné par un <div> absolu
        posé à côté de la case, faute d'utiliser l'état natif de la primitive.
      */}
      {props.checked === "indeterminate" ? (
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <rect x="4.5" y="9" width="11" height="2" rx="1" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

