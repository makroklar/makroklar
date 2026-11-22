import styles from './ArrowIcon.module.css';

interface ArrowIconProps {
  direction?: 'left' | 'right';
  tone?: 'primary' | 'accent' | 'inherit';
}

export function ArrowIcon({
  direction = 'right',
  tone = 'primary',
}: ArrowIconProps) {
  return (
    <span
      className={styles.icon}
      data-direction={direction}
      data-tone={tone}
      aria-hidden="true"
    />
  );
}
