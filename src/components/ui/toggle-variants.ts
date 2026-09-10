import { cva } from 'class-variance-authority';

export const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4271B3] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[#4271B3] data-[state=on]:text-white hover:bg-gray-100 hover:text-gray-900 data-[state=on]:hover:bg-[#325a96]',
  {
    variants: {
      variant: {
        default: 'bg-white border border-gray-200 text-gray-700',
        outline: 'border border-gray-200 bg-transparent hover:bg-gray-100',
      },
      size: {
        default: 'h-10 px-3',
        sm: 'h-9 px-2.5',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
