# Dashboard (Inhaber-Ansicht)

Alles unter `/business` nach dem Onboarding. Umgesetzt nach dem Figma-Prototyp
(Seite „high fidelity neues onboarding“). Animationen sind bewusst weggelassen.

## Seiten

| Route | Datei | Inhalt |
|---|---|---|
| `/business` | `DashboardPage.tsx` | Begrüßung, Fortschritt, QR-Scans, Auslastung, To-do-Liste |
| `/business/aufgaben/[task]` | `TaskOverviewPage.tsx` | Offene Einträge einer Aufgabe, Fortschritt, nächster Schritt |
| `/business/aufgaben/[task]/[item]` | `TaskItemPage.tsx` | Bearbeiten eines Eintrags (Editor je nach Aufgabe) |
| `/business/menu` | `MenuPage.tsx` | Speisekarte: Gerichte mit vollständigen Nährwerten |
| `/business/rezepte` | `RecipeLibraryPage.tsx` | Rezeptbibliothek mit Suche und Filtern |
| `/business/hinzufuegen` | `AddItemPage.tsx` | Auswahl: Gericht, Basis, Produkt |
| `/business/neu/gericht` | `NewRecipePage.tsx` | Neues eigenes Gericht |
| `/business/neu/basis` | `NewRecipePage.tsx` | Neue Basis (Zutaten und gekochtes Endgewicht) |
| `/business/neu/produkt` | `NewProductPage.tsx` | Lebensmittel mit eigenen Nährwerten (gleiches Formular wie im Onboarding) |
| `/business/profil` | `ProfilePage.tsx` | Profil, Schnittstellen, Abmelden |

Die Routen liegen in `src/app/business/(dashboard)/`. Das Layout dort prüft die Anmeldung
und legt die seitliche Tab-Bar (`components/navigation/NavRail.tsx`, mobil unten) um alle Seiten.

## Daten: eine Quelle, ein Speicherweg

```
Supabase ──► data/restaurantData.ts ──► Seiten (nur lesen)
             (getRestaurantData, getTasks, getTask, getRecipe)

Editor ──► data/saveDashboardAction.ts ──► finishOnboarding ──► save_restaurant_onboarding_v2
```

- **Lesen:** Seiten holen Daten ausschließlich über `data/restaurantData.ts`. Die Datei liest die
  importierten Kassenartikel (`readSavedMenu`) und den Onboarding-Stand (`readOnboarding`) und
  bildet daraus `Recipe`-Objekte (Typen in `data/dashboardModel.ts`). Basisrezepte kommen aus dem
  Onboarding-Stand v2 (`basisRecipes`) und werden zu `Recipe` mit `kind: 'basis'`; das gekochte
  Gewicht ist ihre gemessene Nettomenge (`outputQuantity`).
- **Schreiben:** `data/saveDashboardAction.ts` lädt den aktuellen Onboarding-Stand, ändert eine
  Stelle (ein Rezept, ein neues Gericht, eine Basis, ein neues Lebensmittel) und speichert alles über
  dieselbe geprüfte Funktion wie „Einrichtung abschließen“ (v2). Basen und ihre Verknüpfungen zu
  Gerichten werden dabei unverändert mitgeschickt. Die Datenbank berechnet danach die Nährwerte.
- **Rezept-Schlüssel (`slug`):** `lightspeed-k-series-<sourceId>` für Kassenartikel,
  `manual-<uuid>` für eigene Gerichte, `basis-<uuid>` für Basisrezepte. Das sind dieselben Schlüssel wie in `recipes` des Onboardings.
- **Aufgaben** sind Filterregeln über die Rezepte (`getTasks` in `restaurantData.ts`). Texte stehen
  in `TASK_TEMPLATES` (`dashboardModel.ts`). Es gibt keine Beispieldaten. Aufgaben ohne Datenquelle
  haben `available: false`.
- **Fortschritt** (`getProgress`): Speisekarte importieren plus die vier Aufgaben, jeder Schritt zählt
  gleich, Aufgaben anteilig (`done / total`). Aufgaben mit `available: false` zählen nicht mit – sobald
  ihre Daten in der Datenbank sind, `available` auf true setzen.

## Vorschlag für die fehlenden Status-Felder

`src/shared/supabase/migrations/20261125000100_add_dish_dashboard_status.sql` – **noch nicht
angewendet**, erst nach Review und nach den Basen-Migrationen (20261124000200–0400). Sie ergänzt
an `dishes`: `recipe_confirmed_at` (Import prüfen), `allergens`/`additives`/`allergens_confirmed_at`
(LMIV-Freigabe), `published_at` (Speisekarte) sowie `category`, `prep_minutes`, `cooked_weight_g`
(Editor). Gelesen wird direkt aus `dishes`, geschrieben nur über `set_dish_recipe_confirmed`,
`save_dish_allergens`, `set_dish_published` und `save_dish_details`.

Offen für die Speicherfunktion v2: Bestätigungen und Veröffentlichung zurücksetzen, wenn sich
Zutaten oder Mengen eines Gerichts wirklich ändern.

## Was die Datenbank noch nicht kann

Die Oberfläche ist dafür vorbereitet, zeigt aber leere Zustände oder „Folgt bald“:

| Fehlt | Wo es sichtbar wird | Was zu tun ist |
|---|---|---|
| „Rezept geprüft“-Merker | Aufgabe „Import prüfen“ (leer) | Merker pro Gericht; in `getTasks` die Regel für `import-pruefen` setzen |
| „Veröffentlicht“-Merker | Speisekarte zeigt alle Gerichte mit vollständigen Nährwerten | `onMenu` in `buildDish` (`restaurantData.ts`) aus dem Merker lesen; Button in `LmivReview.tsx` speichern lassen |
| Allergene / Zusatzstoffe | LMIV-Freigabe: Auswahl wird nicht gespeichert | Tabelle + Speichern in `LmivReview.tsx` |
| Kochgewicht (Gerichte), Zubereitungszeit, Kategorie | Felder im Editor mit Hinweis „wird noch nicht gespeichert“ (bei Basen wird das Kochgewicht gespeichert) | Spalten + Speichern in `saveDish` |
| Basen mit Gerichten verknüpfen | Nur im Onboarding (Schritt „Gerichte vervollständigen“), noch nicht im Dashboard-Editor | `dishBases` in `saveDish` setzen, Auswahl im Editor |
| QR-Scans, Auslastung, Team, Fotos, Benachrichtigungen | Dashboard und Profil | jeweils eigene Tabellen |
