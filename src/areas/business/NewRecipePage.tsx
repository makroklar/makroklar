import { PageHeader } from './components/dashboard/PageHeader';
import { RecipeEditor } from './components/editor/RecipeEditor';
import type { RecipeKind } from './data/dashboardModel';
import { getRestaurantData } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';

// „Neues Gericht erstellen“ / „Neue Basis hinzufügen“ – erreichbar über „Hinzufügen“
export async function NewRecipePage({ kind }: { kind: RecipeKind }) {
  const dish = kind === 'dish';
  const { foods } = await getRestaurantData();

  return (
    <div className={ui.page}>
      <PageHeader
        back={{ href: '/business/hinzufuegen', label: 'Zurück' }}
        title={dish ? 'Neues Gericht erstellen' : 'Neue Basis hinzufügen'}
        subtitle={dish ? 'Zutaten und Mengen für eine Portion eintragen.' : 'Zutaten und gekochtes Ergebnis abwiegen.'}
      />
      <RecipeEditor
        kind={kind}
        initial={{
          ingredients: [],
          category: dish ? 'Eigene Gerichte' : 'Sauce',
          cookedWeight: null,
          portionSize: dish ? 1 : undefined,
          portionUnit: dish ? 'Portion' : undefined,
        }}
        ingredientsTitle={dish ? 'Zutaten & Mengen' : 'Rezeptgrundlage'}
        weighing={false}
        foods={foods}
        save={dish ? { mode: 'newDish', href: '/business/rezepte' } : { mode: 'preview', href: '/business' }}
      />
    </div>
  );
}
