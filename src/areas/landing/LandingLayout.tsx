import type { ReactNode } from 'react';
// Poppins lokal gehostet (DSGVO) – keine Anfragen an Google Fonts
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/700.css';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import styles from './LandingLayout.module.css';

export function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout} data-area="landing">
      <Header />
      <main className={styles.main}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
