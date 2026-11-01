import Image from 'next/image';
import Link from 'next/link';
import { cn } from '../../lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="makroklar – zur Startseite" className={cn('inline-flex', className)}>
      <Image src="/images/logo.png" alt="" width={188} height={33} priority className="h-auto w-full" />
    </Link>
  );
}
