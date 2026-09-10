import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/utils";

/**
 * Popover Radix — pour les panneaux flottants au contenu interactif riche.
 *
 * Distinct de `DropdownMenu` : un menu impose la sémantique `menuitem` et son
 * propre pilotage clavier, ce qui convient mal à un panneau contenant des
 * bascules et des sélecteurs de période imbriqués.
 *
 * Le contenu est PORTALISÉ vers `document.body`. C'est la raison d'être de ce
 * composant ici : le rail de contrôles a une zone défilante en
 * `overflow-x: hidden`, qui rognait entièrement un panneau positionné en
 * `absolute` à l'intérieur — rendu, mais invisible et non cliquable.
 */
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 10, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={12}
      className={cn(
        "z-popover outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent };
