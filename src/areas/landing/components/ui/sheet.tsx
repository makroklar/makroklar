'use client';

import type { ComponentProps } from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      {/* Portal landet außerhalb des Layouts, daher data-area für die Design-Variablen */}
      <div data-area="landing">
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <SheetPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-[min(320px,85vw)] flex-col bg-card p-5 font-sans text-ink shadow-panel-lg',
            className,
          )}
          {...props}
        >
          {children}
          <SheetPrimitive.Close
            aria-label="Menü schließen"
            className="absolute top-5 right-5 flex size-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-transparent text-brand"
          >
            <X aria-hidden className="size-6" />
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </div>
    </SheetPrimitive.Portal>
  );
}
