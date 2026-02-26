import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { cn } from "../../lib/utils"

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-1 shadow-sm",
      className
    )}
    {...props}
  />
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "flex-1 inline-flex items-center justify-center rounded-sm px-2 py-1.5 text-sm font-medium min-w-0",
      "transition-all duration-150 ease-in-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3] focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
      // Séparateur vertical en fin de bloc (inline-end pour RTL)
      "relative after:content-[''] after:absolute after:end-0 after:top-1/2 after:-translate-y-1/2 after:w-px after:h-4 after:bg-gray-200",
      "last:after:hidden",
      // État sélectionné (on) - fond bleu #4271B3 avec texte blanc
      "data-[state=on]:bg-[#4271B3] data-[state=on]:text-white data-[state=on]:font-medium data-[state=on]:shadow-sm",
      "data-[state=on]:after:hidden",
      // État non sélectionné (off) - fond transparent avec texte gris
      "data-[state=off]:bg-transparent data-[state=off]:text-gray-600",
      "hover:data-[state=off]:bg-gray-100 hover:data-[state=off]:text-gray-900",
      className
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }

