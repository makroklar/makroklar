import { useId } from 'react';

const FRONT_HEAD = { cx: 9, cy: 9, r: 3.5 };
const FRONT_BODY = 'M2 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h5a4.5 4.5 0 0 1 4.5 4.5V21';

// Zwei Personen hintereinander, die hintere nach rechts oben versetzt (Strich-Stil wie IconClock).
// Die Maske spart den Bereich der vorderen Person aus, damit die hintere verdeckt wirkt.
export function IconUsers({ size = 14 }: { size?: number }) {
  const maskId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <g fill="black" stroke="black" strokeWidth={5}>
          <circle {...FRONT_HEAD} />
          <path d={FRONT_BODY} />
        </g>
      </mask>

      {/* hintere Person */}
      <g mask={`url(#${maskId})`}>
        <circle cx="15" cy="6" r="3.5" />
        <path d="M8 18v-1.5a4.5 4.5 0 0 1 4.5-4.5h5a4.5 4.5 0 0 1 4.5 4.5V18" />
      </g>

      {/* vordere Person */}
      <circle {...FRONT_HEAD} />
      <path d={FRONT_BODY} />
    </svg>
  );
}
