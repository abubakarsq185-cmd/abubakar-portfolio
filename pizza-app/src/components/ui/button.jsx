import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/* shadcn/ui Button pattern (new-york), themed for Town Pizza Hut */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-oswald uppercase tracking-wider transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-br from-red-bright to-red text-white shadow-[0_10px_30px_rgba(225,27,34,.45)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(225,27,34,.6)]',
        ghost:
          'border-2 border-gold text-gold bg-gold/5 hover:bg-gold hover:text-maroon-deep hover:-translate-y-0.5',
        wa: 'bg-[#25D366] text-white hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(37,211,102,.4)]',
      },
      size: {
        default: 'text-[15px] px-9 py-4',
        sm: 'text-[13px] px-5 py-2.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? 'span' : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
