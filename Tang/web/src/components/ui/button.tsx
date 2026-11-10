import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Variants follow the ui-v2 preview: .btn-primary / -secondary / -ghost / -danger.
// Focus ring comes from the global :focus-visible rule (2 px cyan outline, 2 px offset).
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent text-center text-[15px] leading-tight font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:bg-accent-hi',
        danger: 'border-err/45 bg-transparent text-err hover:bg-err/12',
        secondary: 'border-line-2 bg-raised text-tx hover:border-accent hover:bg-line/50',
        ghost: 'bg-transparent text-tx-2 hover:bg-raised hover:text-tx',
      },
      size: {
        // min 44px touch target (CLAUDE.md UI rule); lg = 52px (btn-lg)
        default: 'min-h-11 px-4 py-1.5',
        sm: 'min-h-11 px-3',
        lg: 'min-h-13 px-5 py-2 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
