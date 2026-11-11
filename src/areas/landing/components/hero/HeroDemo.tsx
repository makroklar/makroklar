'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { demoDishes } from '../../content/home';

const DISH_DURATION_MS = 6500;
const COUNT_DURATION_MS = 900;

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

/** Zählt bei jedem Gerichtswechsel hoch; der erste Wert steht sofort da */
function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const reduced = useReducedMotion();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current || reduced) {
      isFirstRun.current = false;
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / COUNT_DURATION_MS, 1);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);

  return value;
}

function toBreadUnits(carbs: number) {
  return (Math.round((carbs / 12) * 2) / 2).toLocaleString('de-DE');
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <m.div
      variants={rowVariants}
      className="flex items-center justify-between gap-3 rounded-xl bg-page px-3.5 py-3 text-xs/[18px]"
    >
      <span className="text-ink-muted">{label}</span>
      <span className="text-[13px] font-bold whitespace-nowrap text-brand">{value}</span>
    </m.div>
  );
}

export function HeroDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % demoDishes.length), DISH_DURATION_MS);
    return () => clearInterval(timer);
  }, [inView, reduced]);

  const dish = demoDishes[index];
  const carbs = useCountUp(dish.carbs);
  const energy = useCountUp(dish.energy);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Beispiel: Aus Rezeptdaten werden verständliche Nährwerte für Gäste."
      className="relative mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-[32px] bg-lime-soft px-4 py-6 xl:h-[520px] xl:max-w-none xl:bg-transparent xl:p-0"
    >
      <div className="absolute top-6 left-[15px] hidden h-[468px] w-[510px] rounded-[44px] bg-lime-soft xl:block" />

      <div className="relative w-full rounded-[20px] bg-card px-5 py-5.5 shadow-panel xl:absolute xl:top-[170px] xl:left-1 xl:w-[220px] xl:pr-8">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={dish.name} variants={listVariants} initial="hidden" animate="visible" exit="exit">
            <p className="mb-0 text-[19px]/[26px] font-bold text-ink">{dish.name}</p>
            <p className="mt-1 mb-3 border-b border-line pb-3 text-[11px]/[17px] text-ink-muted">Aus deinen Rezeptdaten</p>
            <div className="flex flex-col gap-3">
              {dish.ingredients.map((ingredient) => (
                <m.div
                  key={ingredient.name}
                  variants={rowVariants}
                  className="flex items-center justify-between gap-2 text-[13px]/[18px] whitespace-nowrap"
                >
                  <span className="font-medium text-ink">{ingredient.name}</span>
                  <span className="font-bold text-brand">{ingredient.amount}</span>
                </m.div>
              ))}
            </div>
          </m.div>
        </AnimatePresence>
      </div>

      {/* Animation per CSS (.pulse-soft in landing.css); die Drehung sitzt am Icon,
          damit transform am Kreis frei für die Animation ist */}
      <div className="pulse-soft relative z-10 -my-6 flex size-13 items-center justify-center rounded-full bg-brand text-lime shadow-soft xl:absolute xl:top-[246px] xl:left-[202px] xl:my-0">
        <ArrowRight aria-hidden className="size-6 rotate-90 xl:rotate-0" strokeWidth={2.5} />
      </div>

      <div className="relative w-full rounded-3xl border border-brand bg-card px-6 py-6.5 shadow-panel-lg xl:absolute xl:top-[76px] xl:left-[230px] xl:w-[310px]">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={dish.name} variants={listVariants} initial="hidden" animate="visible" exit="exit">
            <p className="mb-0 text-2xl/[32px] font-bold text-brand">{dish.name}</p>
            <p className="mt-1 mb-3.5 text-xs/[18px] text-ink-muted">Verständlich auf einen Blick</p>
            <div className="flex flex-col gap-3.5">
              <ValueRow label="Kohlenhydrate" value={`ca. ${carbs} g · ${toBreadUnits(dish.carbs)} BE`} />
              <ValueRow label="Energie" value={`ca. ${energy} kcal`} />
              <ValueRow label="Allergene" value={dish.allergens} />
            </div>
            <m.div variants={rowVariants} className="mt-3.5 flex items-center justify-between gap-2">
              <span className="rounded-full bg-brand px-2.75 py-1.75 text-[10px]/[14px] font-bold text-lime">
                Angaben geprüft
              </span>
              <span className="text-[10px] text-ink-muted">Beispielwerte</span>
            </m.div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
