# To-dos

Offene Punkte, die noch nicht erledigt sind. Erledigtes einfach löschen.

## Fotos von Gerichten

Stand: Der Foto-Editor (`src/areas/business/components/editor/PhotoField.tsx`, `PhotoCropDialog.tsx`) läuft nur im Browser. Fotos werden noch nirgends gespeichert und sind nach dem Neuladen weg.

- [ ] **Upload bauen:** fertiges Foto nach „Übernehmen“ in den Supabase-Storage-Bucket `dish-photos` hochladen und am Gericht speichern.
- [ ] **Migration anwenden:** `src/shared/supabase/migrations/20261124000100_create_dish_photos_bucket.sql` auf `makroklar-dev` anwenden. Der Bucket begrenzt serverseitig auf 5 MB und JPEG/WebP/PNG.
- [ ] **Storage-Policies:** Lese- und Schreibrechte je Restaurant (z. B. Pfad `<restaurant_id>/<dish_id>.webp`, nur Mitglieder des Restaurants). Bis dahin kommt nur der Service-Key an den Bucket.
- [ ] **Kategorie und Zubereitungszeit speichern:** werden im Gericht-Editor angezeigt, aber noch nicht gesichert.
- [ ] **Datenschutzerklärung:** solange Modell und Laufzeit von Hugging Face und jsDelivr kommen, dort erwähnen.
