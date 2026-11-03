import type { CSSProperties } from 'react';
import type { StaticImageData } from 'next/image';
import Link from 'next/link';
import styles from './ChoiceCard.module.css';

interface ChoiceCardContent {
  title: string;
  description: string;
  icon: StaticImageData;
}

type ChoiceCardProps = ChoiceCardContent &
  (
    | { href: string; name?: never; value?: never }
    | { href?: never; name: string; value: string }
  );

export function ChoiceCard({ title, description, icon, ...action }: ChoiceCardProps) {
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
      <Link className={styles.card} href={action.href}>
        {content}
      </Link>
    );
  }

  return (
    <label className={styles.card}>
      <input
        className={styles.visuallyHidden}
        type="radio"
        name={action.name}
        value={action.value}
      />
      {content}
    </label>
  );
}
