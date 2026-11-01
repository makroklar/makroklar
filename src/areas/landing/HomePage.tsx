import { Community } from './components/community/Community';
import { FinalCta } from './components/cta/FinalCta';
import { Benefits } from './components/features/Benefits';
import { Hero } from './components/hero/Hero';
import { Process } from './components/process/Process';

export function HomePage() {
  return (
    <div className="w-full min-w-0">
      <Hero />
      <Benefits />
      <Process />
      <Community />
      <FinalCta />
    </div>
  );
}
