import { ImageResponse } from 'next/og';

export const alt = 'makroklar – Nährwerte verständlich. Entscheidungen sicherer.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 96,
        background: '#00604b',
        color: '#ffffff',
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, color: '#d1d739' }}>makroklar.</div>
      <div style={{ fontSize: 44, marginTop: 24 }}>Nährwerte verständlich. Entscheidungen sicherer.</div>
    </div>,
    size,
  );
}
