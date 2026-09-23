import { cn } from '../../lib/utils';

/** Segmented control compact — style rail, pour les barres temporelles du panneau. */
export const chartSegmentGroupClass =
  'inline-flex w-full gap-0.5 rounded-lg border border-[rgb(16_32_56_/_0.08)] bg-[rgb(16_32_56_/_0.04)] p-0.5 shadow-none';

export const chartSegmentItemClass = cn(
  'h-8 min-h-0 flex-1 rounded-md px-1.5 text-[11px] font-medium leading-none sm:text-xs',
  'shadow-none after:hidden',
  'data-[state=on]:bg-white data-[state=on]:text-[color:var(--fg)] data-[state=on]:shadow-sm',
  'data-[state=on]:ring-1 data-[state=on]:ring-[rgb(16_32_56_/_0.08)]',
  'data-[state=off]:bg-transparent data-[state=off]:text-[color:var(--fg-muted)]',
  'hover:data-[state=off]:bg-white/60 hover:data-[state=off]:text-[color:var(--fg)]'
);
