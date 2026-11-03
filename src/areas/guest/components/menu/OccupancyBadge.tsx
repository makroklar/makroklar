import { IconClock } from '@/shared/components/icons/IconClock';
import styles from './OccupancyBadge.module.css';

type OccupancyBadgeProps = {
  /** z. B. „Normaler Betrieb“ */
  status: string;
  onClick?: () => void;
};

// Aktuelle Auslastung des Restaurants (Figma „Gastansicht“, Frame 97) – mit onClick als Button
export function OccupancyBadge({ status, onClick }: OccupancyBadgeProps) {
  const content = (
    <>
      <span className={styles.icon}>
        <IconClock />
      </span>
      <span className={styles.label}>
        Aktuelle Auslastung: <strong className={styles.status}>{status}</strong>
      </span>
    </>
  );

  return onClick ? (
    <button type="button" className={styles.badge} onClick={onClick}>
      {content}
    </button>
  ) : (
    <p className={styles.badge}>{content}</p>
  );
}
