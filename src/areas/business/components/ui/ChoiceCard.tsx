'use client';

import type { CSSProperties } from 'react';
import type { StaticImageData } from 'next/image';
import Link from 'next/link';
import styles from './ChoiceCard.module.css';

interface ChoiceCardContent {
  className?: string;
  title: string;
  description: string;
  icon: StaticImageData;
}

type ChoiceCardProps = ChoiceCardContent &
  (
    | {
        href: string;
        name?: never;
        value?: never;
        type?: never;
        checked?: never;
        onCheckedChange?: never;
      }
    | {
        href?: never;
        name: string;
        value: string;
        type?: 'radio' | 'checkbox';
        checked?: boolean;
        onCheckedChange?: (checked: boolean) => void;
      }
  );

export function ChoiceCard({ className, title, description, icon, ...action }: ChoiceCardProps) {
  const cardClassName = className ? `${styles.card} ${className}` : styles.card;
  // The local SVG supplies its shape and intrinsic size; CSS supplies state colors.
  const iconStyle = {
    '--choice-icon-url': `url("${icon.src}")`,
    '--choice-icon-width': `${icon.width}px`,
    '--choice-icon-height': `${icon.height}px`,
  } as CSSProperties;

  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <span className={styles.iconShape} style={iconStyle} />
      </span>
      <span className={styles.title}>{title}</span>
      <span className={styles.description}>{description}</span>
    </>
  );

  if (action.href !== undefined) {
    return (
      <Link className={cardClassName} href={action.href}>
        {content}
      </Link>
    );
  }

  return (
    <label className={cardClassName}>
      <input
        className={styles.visuallyHidden}
        type={action.type ?? 'radio'}
        name={action.name}
        value={action.value}
        checked={action.checked}
        onChange={
          action.onCheckedChange
            ? (event) => action.onCheckedChange?.(event.target.checked)
            : undefined
        }
      />
      {content}
    </label>
  );
}
