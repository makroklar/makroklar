// Gewicht wie Lucide „Weight“, zusätzlich mit „kg“ im Gewicht. Farbe über currentColor
export function IconWeightKg({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="3" />
      <path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z" />
      {/* „kg“ als Linien, dünner, damit es klein lesbar bleibt */}
      <g strokeWidth={strokeWidth * 0.7}>
        <path d="M8 11.5v5M10.5 13.5 8 15.5M9.2 14.6l1.3 1.9" />
        <circle cx="14" cy="15" r="1.5" />
        <path d="M15.5 13.5v4a1.5 1.5 0 0 1-2.7.9" />
      </g>
    </svg>
  );
}
