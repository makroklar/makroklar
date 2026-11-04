import { Clock, FileText, ShieldCheck, Upload } from 'lucide-react';

export const benefits = [
  {
    icon: Upload,
    title: 'Ohne Vorwissen starten',
    text: 'Speisekarte oder Rezeptdaten hochladen und daraus einen ersten Entwurf erstellen.',
  },
  {
    icon: ShieldCheck,
    title: 'Gästen Orientierung geben',
    text: 'Menschen mit Diabetes oder Allergien finden schneller, was zu ihnen passt.',
  },
  {
    icon: FileText,
    title: 'Angaben verlässlich prüfen',
    text: 'Erkannte Zutaten, Mengen und Allergene vor der Veröffentlichung kontrollieren.',
  },
  {
    icon: Clock,
    title: 'Schrittweise einführen',
    text: 'Mit einzelnen Gerichten beginnen und später die ganze Karte ergänzen.',
  },
];

export const steps = [
  {
    title: 'Verbinden oder hochladen',
    text: 'Verbinde dein Kassensystem oder lade deine Speisekarte einfach als Datei hoch.',
  },
  {
    title: 'Automatisch berechnet und selber prüfen',
    text: 'makroklar erkennt Zutaten, Mengen und Allergene und zeigt, wo noch Informationen fehlen.',
  },
  {
    title: 'Mit Gästen teilen',
    text: 'Freigegebene Werte erscheinen verständlich in deiner digitalen Speisekarte.',
  },
];

export const quotes = [
  {
    text: '„Also was ich praktisch fände, wär halt einfach, wenn die Werte auf der Speisekarte stehen.“',
    source: 'Interview mit Betroffener',
  },
  {
    text: '„Wenn Sie draufschreiben müssten, da sind circa so viel Kohlenhydrate … dreißig bis vierzig würde mir schon helfen.“',
    source: 'Interview mit Betroffenem',
  },
  {
    text: '„Es würde auch ausreichend für mich. Also irgendwas, wo man nachschauen kann, wie viele Kohlenhydrate da drin sind.“',
    source: 'Interview mit Betroffener',
  },
];

/** Grob gerechnete Beispielwerte für die Hero-Demo, keine echten Rezeptdaten */
export const demoDishes = [
  {
    name: 'Pizza Margherita',
    ingredients: [
      { name: 'Pizzateig', amount: '250 g' },
      { name: 'Tomatensoße', amount: '90 g' },
      { name: 'Mozzarella', amount: '80 g' },
    ],
    carbs: 125,
    energy: 900,
    allergens: 'Gluten · Milch',
  },
  {
    name: 'Ofenkartoffel',
    ingredients: [
      { name: 'Kartoffel', amount: '300 g' },
      { name: 'Kräuterquark', amount: '120 g' },
      { name: 'Schnittlauch', amount: '5 g' },
    ],
    carbs: 53,
    energy: 350,
    allergens: 'Milch',
  },
  {
    name: 'Linsen-Bowl',
    ingredients: [
      { name: 'Linsen, gekocht', amount: '180 g' },
      { name: 'Reis, gekocht', amount: '120 g' },
      { name: 'Gemüse', amount: '150 g' },
    ],
    carbs: 75,
    energy: 430,
    allergens: 'keine',
  },
];
