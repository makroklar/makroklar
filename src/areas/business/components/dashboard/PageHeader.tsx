import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './Dashboard.module.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, back, icon, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        {icon && <span className={styles.headerIcon} aria-hidden="true">{icon}</span>}
        <div>
          {back && (
            <Link className={styles.backLink} href={back.href}>
              <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.25} />
              {back.label}
            </Link>
          )}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}
