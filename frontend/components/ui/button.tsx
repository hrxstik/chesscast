import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader } from 'lucide-react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'hover:cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0',
    'outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    /* Адаптив размера кнопки (без пропа size): max-md → md → lg → laptop → desktop */
    'min-h-9 px-4 py-2 text-sm has-[>svg]:px-3',
    'md:min-h-10 md:px-5 md:text-base md:has-[>svg]:px-4',
    'lg:min-h-10 lg:px-5',
    'laptop:min-h-11 laptop:px-6 laptop:text-base',
    'desktop:min-h-12 desktop:px-8',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, children, disabled, loading, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, className }))}
        ref={ref}
        {...props}>
        {!loading ? children : <Loader className="h-5 w-5 animate-spin" />}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
