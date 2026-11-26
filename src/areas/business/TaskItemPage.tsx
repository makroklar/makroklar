import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { ImportReview } from './components/editor/ImportReview';
import { LmivReview } from './components/editor/LmivReview';
import { RecipeEditor } from './components/editor/RecipeEditor';
import { getRecipe, getRestaurantData, getTask } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';

// Einzelner Eintrag einer Aufgabe, z. B. /business/aufgaben/basis-abwiegen/tomatensosse
export async function TaskItemPage({ taskId, slug }: { taskId: string; slug: string }) {
  const [task, recipe, { foods }] = await Promise.all([getTask(taskId), getRecipe(slug), getRestaurantData()]);
  if (!task || !recipe) notFound();

  const back = { href: `/business/aufgaben/${task.id}`, label: 'Zurück zur Übersicht' };
  const editorValues = {
    ingredients: recipe.ingredients,
    category: recipe.category,
    cookedWeight: recipe.cookedWeight,
    portionSize: recipe.portion?.size,
    portionUnit: recipe.portion?.unit,
    price: recipe.price,
    priceFromPos: recipe.priceFromPos,
    prepMinutes: recipe.prepMinutes,
  };

  if (task.id === 'import-pruefen') {
    return (
      <div className={ui.page}>
        <PageHeader back={back} title={`Rezept-Import prüfen: ${recipe.name}`} />
        <ImportReview recipe={recipe} foods={foods} />
      </div>
    );
  }

  if (task.id === 'basis-abwiegen') {
    if (recipe.kind !== 'basis') notFound();
    return (
      <div className={ui.page}>
        <PageHeader back={back} title={`Basis abwiegen: ${recipe.name}`} subtitle="Zutaten und gekochtes Ergebnis abwiegen." />
        <RecipeEditor
          kind="basis"
          initial={editorValues}
          ingredientsTitle="Rezeptgrundlage"
          ingredientsHint="Mengen für die ganze Zubereitung. Danach das fertige Ergebnis einmal wiegen."
          weighing
          foods={foods}
          save={{ mode: 'basis', id: recipe.slug.slice('basis-'.length), href: '/business/aufgaben/basis-abwiegen' }}
        />
      </div>
    );
  }

  if (recipe.kind !== 'dish') notFound();

  if (task.id === 'gerichte-einrichten') {
    return (
      <div className={ui.page}>
        <PageHeader back={back} title={`${recipe.name} einrichten`} subtitle="Zutaten und Mengen für eine Portion eintragen." />
        <RecipeEditor
          kind="dish"
          initial={editorValues}
          ingredientsTitle="Zutaten & Mengen"
          ingredientsHint="Mengen pro Portion. Daraus werden die Nährwerte berechnet."
          weighing
          foods={foods}
          save={{ mode: 'dish', key: recipe.slug, href: '/business/aufgaben/gerichte-einrichten' }}
          secondary={recipe.nutrition ? { href: `/business/aufgaben/lmiv-freigabe/${recipe.slug}`, label: 'LMIV-Check öffnen' } : undefined}
        />
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <PageHeader
        back={back}
        title={`LMIV-Freigabe: ${recipe.name}`}
        subtitle="Prüfe Allergene und Zusatzstoffe so, wie Gäste sie später sehen."
        actions={(
          <Link
            className={`${ui.iconButton} ${ui.iconButtonFilled}`}
            href={`/business/aufgaben/gerichte-einrichten/${recipe.slug}`}
            aria-label={`${recipe.name} bearbeiten`}
          >
            <Pencil aria-hidden="true" size={18} />
          </Link>
        )}
      />
      <LmivReview recipe={recipe} />
    </div>
  );
}
