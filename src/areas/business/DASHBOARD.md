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
| `/business/neu/basis` | `NewRecipePage.tsx` | Neue Basis (Formular, speichert noch nicht) |
| `/business/neu/produkt` | `NewProductPage.tsx` | Lebensmittel mit eigenen Nährwerten (gleiches Formular wie im Onboarding) |
| `/business/profil` | `ProfilePage.tsx` | Profil, Schnittstellen, Abmelden |

Die Routen liegen in `src/app/business/(dashboard)/`. Das Layout dort prüft die Anmeldung
und legt die seitliche Tab-Bar (`components/navigation/NavRail.tsx`, mobil unten) um alle Seiten.

## Daten: eine Quelle, ein Speicherweg

```
Supabase ──► data/restaurantData.ts ──► Seiten (nur lesen)
             (getRestaurantData, getTasks, getTask, getRecipe)

Editor ──► data/saveDashboardAction.ts ──► finishOnboarding ──► save_restaurant_onboarding
```

- **Lesen:** Seiten holen Daten ausschließlich über `data/restaurantData.ts`. Die Datei liest die
  importierten Kassenartikel (`readSavedMenu`) und den Onboarding-Stand (`readOnboarding`) und
  bildet daraus `Recipe`-Objekte (Typen in `data/dashboardModel.ts`).
- **Schreiben:** `data/saveDashboardAction.ts` lädt den aktuellen Onboarding-Stand, ändert eine
  Stelle (ein Rezept, ein neues Gericht, ein neues Lebensmittel) und speichert alles über dieselbe
  geprüfte Funktion wie „Einrichtung abschließen“. Die Datenbank berechnet danach die Nährwerte.
- **Rezept-Schlüssel (`slug`):** `lightspeed-k-series-<sourceId>` für Kassenartikel,
  `manual-<uuid>` für eigene Gerichte. Das sind dieselben Schlüssel wie in `recipes` des Onboardings.
- **Aufgaben** sind Filterregeln über die Rezepte (`getTasks` in `restaurantData.ts`). Texte stehen
  in `TASK_TEMPLATES` (`dashboardModel.ts`). Es gibt keine Beispieldaten.

## Was die Datenbank noch nicht kann

Die Oberfläche ist dafür vorbereitet, zeigt aber leere Zustände oder „Folgt bald“:

| Fehlt | Wo es sichtbar wird | Was zu tun ist |
|---|---|---|
| Basen / Teilrezepte | Aufgabe „Basis abwiegen“ (leer), „Neue Basis“ speichert nicht | Neuer Typ in der Datenbank; danach in `restaurantData.ts` Basen als `Recipe` mit `kind: 'basis'` liefern, in `getTasks` die Regel für `basis-abwiegen` setzen, im Editor `save.mode` für Basen ergänzen |
| „Rezept geprüft“-Merker | Aufgabe „Import prüfen“ (leer) | Merker pro Gericht; in `getTasks` die Regel für `import-pruefen` setzen |
| „Veröffentlicht“-Merker | Speisekarte zeigt alle Gerichte mit vollständigen Nährwerten | `onMenu` in `buildDish` (`restaurantData.ts`) aus dem Merker lesen; Button in `LmivReview.tsx` speichern lassen |
| Allergene / Zusatzstoffe | LMIV-Freigabe: Auswahl wird nicht gespeichert | Tabelle + Speichern in `LmivReview.tsx` |
| Kochgewicht, Portionsgewicht, Zubereitungszeit | Felder im Editor mit Hinweis „wird noch nicht gespeichert“ | Spalten + Speichern in `saveDish` |
| QR-Scans, Auslastung, Team, Fotos, Benachrichtigungen | Dashboard und Profil | jeweils eigene Tabellen |
