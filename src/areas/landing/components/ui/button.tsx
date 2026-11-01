import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'group inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border-0 font-sans font-bold whitespace-nowrap no-underline transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-lime hover:-translate-y-0.5 hover:shadow-soft',
        ghost: 'bg-transparent text-brand hover:bg-brand-tint',
      },
      size: {
        md: 'px-4.5 py-2.75 text-sm',
        lg: 'rounded-[14px] px-5.5 py-3.5 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
