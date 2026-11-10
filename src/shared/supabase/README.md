# Supabase

Gemeinsame Datenbankstruktur und Zugriffsregeln fuer alle Bereiche von makroklar.

- `migrations/`: versionierte SQL-Dateien fuer Tabellen, Beziehungen, Grants und RLS-Policies.
- `checks/`: eigenstaendige SQL-Pruefungen, getrennt von den Migrationen.
- `imports/`: separates BLS-Importwerkzeug und Dateimanifest; siehe [BLS-Import](imports/README.md).

Die zweite Migration `20261109000200_create_bls_catalog.sql` bereitet den globalen
BLS-Referenzkatalog vor. Sie wurde am 2026-11-10 ueber die CLI auf `makroklar-dev`
angewendet; der Migration-History-Eintrag wurde anschliessend bestaetigt.
`checks/bls_catalog.sql` pruefte Constraints, Beziehungen, RLS und Rollenrechte
erfolgreich. Alle Testdaten wurden per `ROLLBACK` entfernt. RLS ist aktiv und jede
BLS-Tabelle hat eine SELECT-Policy. Am 2026-11-10 wurde BLS 4.0 (2025) vollstaendig
importiert: eine aktive Ausgabe, 7.140 Lebensmittel, 138 Definitionen und 985.320
Werte. Quelle, Anzahlen, alle Definitionen und eine Stichprobe wurden geprueft;
ein zweiter Lauf meldete `already_imported`, ohne Duplikate anzulegen.
Der Katalog belegt einschliesslich Indizes rund 175,1 MiB. Die Oberflaechen sind
noch nicht mit dem BLS-Katalog verbunden. Das Importwerkzeug laeuft ohne `--apply`
weiterhin als lokaler Dry-run, ohne Datenbankverbindung.

## Vorbereitete Anwendungs-Clients

`@supabase/supabase-js` ist als Laufzeitabhaengigkeit auf `2.119.0` festgelegt,
`@supabase/ssr` auf `0.12.7`. Die folgenden Dateien bereiten die spaetere Anbindung vor:

| Datei | Aufgabe |
| --- | --- |
| `client.ts` | `createClient()` fuer Client Components; die SSR-Bibliothek verwaltet die Auth-Cookies. |
| `server.ts` | Asynchrones `createClient()` fuer Server Components und Server Actions, mit neuem Client je Aufruf/Request. Route Handlers koennen die ausgehenden `response.headers` uebergeben. |
| `config.ts` | Liest und prueft die beiden oeffentlichen Einstellungen erst bei einem Client-Aufruf. Fehlende Werte blockieren nicht schon den Modulimport. |
| `database.generated.ts` | Unveraenderte, per CLI erzeugte Typen des oeffentlichen Schemas einschliesslich Tabellen, Beziehungen und RPCs. |
| `database.types.ts` | Exportiert den verwendeten `Database`-Typ und korrigiert die nullable Ergebnisse von `get_dish_nutrition`. |

Importe erfolgen gezielt aus `@/shared/supabase/client` oder
`@/shared/supabase/server`; der Server-Client verwendet Next.js `cookies()`.
Die vorhandenen Seiten verwenden die Clients noch nicht. Registrierung, Login,
Routenabsicherung und Session-Refresh sind noch nicht angebunden. Vor echtem Auth
ist insbesondere der Session-Refresh-Proxy noetig; dessen zentraler Einstieg
`src/proxy.ts` wird als eigene, mit dem Team abzustimmende Aenderung behandelt.
Bis dahin werden die Helfer nicht fuer einen fertigen Auth-Ablauf ausgegeben.

Im Repository-Hauptverzeichnis in der ignorierten `.env.local` konfigurieren:

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://osdbsbbcnftussvgumjh.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
```

Die Werte stehen im Supabase Dashboard unter Connect beziehungsweise API Keys.
Hier wird ein neuer `sb_publishable_...`-Key erwartet. Die Anwendungs-Clients
verwenden ausschliesslich diese beiden oeffentlichen Einstellungen. Die fuer
den Import verwendete administrative `BLS_DATABASE_URL`, Datenbankpasswort und
`service_role`-/Secret-Keys gehoeren nicht in `NEXT_PUBLIC_`-Variablen.
Nach Aenderungen an `.env.local` den Entwicklungsserver neu starten. Pro Team-
Rechner wird die lokale Datei separat eingerichtet; sie wird nicht eingecheckt.

Der Server-Client schreibt Cookies in erlaubten Server Actions/Route Handlers;
bei schreibgeschuetzten Server Components bleibt der Refresh Aufgabe des spaeteren
Proxy. Andere Cookie-Fehler werden weitergegeben. In Route Handlers die eigenen
ausgehenden `response.headers` an `createClient(response.headers)` uebergeben und
dieselbe Response zurueckgeben, damit die vom SDK gelieferten privaten Cache-Header
mit den Auth-Cookies ausgegeben werden. Beim spaeteren Proxy muessen ebenfalls
Cookies und Cache-Header auf der richtigen Response erhalten bleiben. Identitaet
wird spaeter ueber `auth.getClaims()`/`getUser()` geprueft; rohe Session-Cookies
sind kein Berechtigungsnachweis.

Der CLI-Generator erkennt nicht, dass die SQL-Funktion `get_dish_nutrition`
bei unvollstaendigen Daten `NULL` liefert. Deshalb bleibt das generierte Original
unveraendert, waehrend `database.types.ts` genau diesen RPC korrigiert:
`complete` hat Zahlenwerte, `incomplete`/`empty_recipe` haben `null`. Beide Clients
verwenden diesen korrigierten Typ. Typen bilden keine RLS-Policies oder
Spaltenrechte ab; die Datenbank erzwingt diese weiterhin bei jedem Zugriff.

Nach weiteren Schemaaenderungen die Roh-Typen neu erzeugen. Aus PowerShell,
ohne npm-Banner in die TypeScript-Datei zu schreiben:

```powershell
$generated = & .\node_modules\.bin\supabase.cmd --workdir src/shared gen types --lang typescript --schema public --remote=osdbsbbcnftussvgumjh
if ($LASTEXITCODE -ne 0) { throw 'Type generation failed' }
$typeFile = Join-Path (Get-Location).Path 'src/shared/supabase/database.generated.ts'
[System.IO.File]::WriteAllText($typeFile, "// Generated from the public Supabase schema. Do not edit by hand.`n" + ($generated -join "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
```

Dabei werden nur Schema-Metadaten gelesen, keine Konten, Kennwoerter oder BLS-
Datensaetze exportiert. Die CLI muss fuer das beabsichtigte Projekt angemeldet sein.

Am 2026-11-10 erfolgreich geprueft: TypeScript, Produktionsbuild und temporaere
Typvertragspruefungen ueber den echten SDK-Client. Ungepruefte nullable RPC-Summen,
ungueltige RPC-Argumente und unbekannte Tabellennamen wurden dabei vom Compiler
abgewiesen. Ein isolierter Lauf mit simulierten SDK-/Next-Cookie-Grenzen pruefte
die oeffentliche Konfiguration, Cookie-Attribute, weitergegebene Cache-Header,
schreibgeschuetzte RSC-Cookies und das Weiterwerfen anderer Cookie-Fehler.
`npm install` meldete null Schwachstellen. Veraltete generierte Next-Routentypen
unter `.next` wurden fuer den aktuellen Branch neu erzeugt.
Nach lokaler Konfiguration des Publishable-Keys bestand am selben Tag auch der
Live-HTTP-Test: Der oeffentliche Auth-Settings-Endpunkt antwortete mit 200.
Der tatsaechliche `client.ts`-Helfer wurde ohne Session in einem isolierten
Node-Prozess aufgerufen. Lesende SDK-Abfragen auf `restaurants`, `dishes` und
`bls_foods` sowie der lesende RPC `get_dish_nutrition` wurden jeweils mit
HTTP 401 / Postgres-Code 42501 blockiert und lieferten keine Daten.
Das bestaetigt die Verbindung und die Anon-Zugriffssperren, noch keinen Browser-
Login oder Cookie-Refresh. Es wurden keine Auth-Konten angelegt, Daten geschrieben
oder bestehende Anwendungsseiten auf die neuen Clients umgestellt. Authentifizierte
HTTP-Aufrufe und der vollstaendige Browser-/Server-Session-Ablauf folgen separat.

Referenzen: [Supabase mit Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&queryGroups=framework),
[Generierte TypeScript-Typen](https://supabase.com/docs/guides/api/rest/generating-types).

## Lokale CLI-Einrichtung

Supabase CLI ist als Entwicklungsabhaengigkeit auf Version `3.1.0` festgelegt.
Nach dem Aktualisieren des Branches installiert `npm.cmd ci` dieselbe Version
auch auf den Rechnern der anderen Teammitglieder.

CLI-Aufrufe aus dem Repository-Hauptverzeichnis laufen ueber:

```powershell
npm.cmd run supabase -- --version
npm.cmd run supabase -- --help
```

Das npm-Skript setzt `--workdir src/shared` automatisch. Die CLI erwartet den
Ordner `supabase/` innerhalb dieses Arbeitsverzeichnisses, nicht als
Arbeitsverzeichnis selbst. Direkte Aufrufe benoetigen denselben Parameter,
zum Beispiel `npx.cmd supabase --workdir src/shared --version`.
Siehe [Supabase CLI](https://supabase.com/docs/reference/cli/introduction).

`config.toml` enthaelt lokale Entwicklungswerte. `project_id = "makroklar"` ist
der lokale Bezeichner und keine Verknuepfung mit einem gehosteten Projekt.
Seed-Daten sind deaktiviert, solange es kein Seed-Skript gibt. Das private
Schema `makroklar_private` ist nicht Teil der exponierten API-Schemas.
`.gitignore` schliesst insbesondere lokale Verbindungsmetadaten in `.temp/` aus.
Anmeldung und Projektverknuepfung erfolgen pro Entwickler lokal. Hier wurde die
CLI mit dem Entwicklungsprojekt `makroklar-dev` verknuepft; ein lokaler
Datenbankdienst wurde nicht gestartet. Die gehosteten Auth-Einstellungen sind unveraendert.

## Erste Migration

`migrations/20261109000100_create_restaurant_foundation.sql` wurde am 2026-11-09
ueber die CLI auf `makroklar-dev` angewendet. Der Eintrag in der Migration History
wurde anschliessend per Read-only-Abfrage bestaetigt. Bereits angewendete
Migrationen nicht nachtraeglich aendern; weitere Schemaaenderungen erhalten eine
neue Migration.

| Tabelle | Inhalt und Beziehung |
| --- | --- |
| `profiles` | Optionale Profilzeile je Auth-Konto: `id` verweist auf `auth.users.id`; `username` ist optional und ohne Beachtung der Gross-/Kleinschreibung eindeutig. |
| `restaurants` | UUID, Name und Erstellungszeit des Restaurants. |
| `restaurant_members` | Verbindet `auth.users` mit `restaurants`; in dieser Version genau ein `owner` je Restaurant. Ein Konto kann mehrere Restaurants besitzen. |

E-Mail und Passwoerter verwaltet ausschliesslich Supabase Auth. Es gibt keine
Gastkonten und keine eigenen Passwortspalten. Ein Auth-Konto benoetigt nicht
bereits eine Profilzeile, um ein Restaurant anzulegen; das Profil kann spaeter
mit der eigenen Auth-ID gespeichert werden.

Ein angemeldeter Benutzer darf sein Profil lesen, anlegen und dessen Benutzernamen
aendern. Er darf seine Restaurants lesen und deren Namen aendern sowie die eigene
Mitgliedschaft lesen. IDs, Erstellungszeiten und Mitgliedschaften sind fuer Clients
nicht frei aenderbar. Nicht angemeldete Besucher erhalten hier keinen Zugriff;
oeffentlich lesbare Speisekarten folgen in einer spaeteren Migration.

`public.create_restaurant(restaurant_name)` legt Restaurant und Besitzer gemeinsam
an und liefert die Restaurant-UUID zurueck. Die Besitzer-ID stammt aus `auth.uid()`,
nicht aus einem vom Client uebergebenen Parameter. Der privilegierte Teil liegt in
`makroklar_private`, der oeffentliche RPC ist `security invoker`. Das private Schema
darf nicht zu den in der Data API exponierten Schemas hinzugefuegt werden.
Direkte Restaurant- oder Mitgliedschafts-Inserts sind fuer Clients gesperrt.

Loeschen von Restaurants, Mitgliedschaften und Profilen ist in dieser Client-API
noch nicht vorgesehen. Ein Auth-Konto mit Restaurantbesitz kann erst geloescht
werden, nachdem der Besitz durch einen spaeteren Verwaltungsablauf aufgeloest wurde.
Administrativer Servercode mit `service_role` hat explizite Schreibrechte und
umgeht RLS; dieser Schluessel darf niemals im Browser verwendet werden.

## Restaurant-Zutaten

`migrations/20261110000100_create_restaurant_ingredients.sql` wurde am 2026-11-10
ueber die CLI auf `makroklar-dev` angewendet. Der Migration-History-Eintrag wurde
anschliessend bestaetigt. `restaurant_ingredients` ist noch leer und hat folgende
Felder:

| Feld | Bedeutung |
| --- | --- |
| `id` | Automatisch erzeugte UUID als stabile Identitaet fuer spaetere Rezept-Zutaten. |
| `restaurant_id` | Verweist auf das Restaurant; administratives Loeschen des Restaurants entfernt auch seine Zutaten. |
| `dataset_id`, `bls_code` | Gemeinsamer Fremdschluessel auf genau ein Lebensmittel einer bestimmten BLS-Ausgabe. |
| `name` | Lokaler, nicht leerer Name ohne fuehrende/nachfolgende Leerzeichen. Die Oberflaeche muss Eingaben vor dem Speichern trimmen. |
| `created_at` | Automatischer Erstellungszeitpunkt. |

Die Nährwerte bleiben im gemeinsamen BLS-Katalog und werden nicht je Restaurant
kopiert. Eine neue aktive BLS-Ausgabe stellt bestehende Zutaten nicht automatisch
um. Solange eine Zutat darauf verweist, kann die referenzierte BLS-Zeile und damit
auch ihre Ausgabe nicht geloescht werden (`ON DELETE RESTRICT`).
Dies schuetzt die Quellenidentitaet; administrative Aenderungen direkt im
Referenzkatalog bleiben technisch moeglich und sollen vermieden werden.

Pro Restaurant und BLS-Identitaet ist genau ein Eintrag erlaubt. Derselbe BLS-Code
darf in verschiedenen Restaurants und in verschiedenen BLS-Ausgaben vorkommen.
Lokale Namen sind nicht eindeutig; die UUID identifiziert die Zutat.

Vier RLS-Policies erlauben dem jeweiligen `owner` Lesen, Anlegen, Aendern und
Loeschen seiner Zutaten. Die Pruefung nutzt die vorhandene `restaurant_members`-
Zuordnung. Ein Konto mit mehreren Restaurants sieht deren Zutaten; fremde
Restaurants, Konten ohne Mitgliedschaft und Besucher haben keinen Zugriff.
Clients koennen `name`, `dataset_id` und `bls_code` aendern, beispielsweise fuer
eine korrigierte Lebensmittelzuordnung. `id`, `restaurant_id` und `created_at`
sind per Spaltenrechten gegen direkte Client-Aenderungen geschuetzt; Zutaten
koennen auch zwischen zwei eigenen Restaurants nicht einfach verschoben werden.
Beim Anlegen werden `restaurant_id`, `dataset_id`, `bls_code` und `name` angegeben,
Identitaet und Zeitstempel erzeugt die Datenbank. Vertrauenswuerdiger Servercode
mit `service_role` hat weiterhin explizite administrative CRUD-Rechte.

`checks/restaurant_ingredients.sql` prueft mit isolierten, rueckrollbaren
Fixtures zwei Besitzer, drei Restaurants, ein Konto ohne Mitgliedschaft,
erlaubte eigene CRUD-Vorgaenge, gesperrte fremde Zugriffe, geschuetzte Spalten,
Duplikate, Namen, versionsgebundene BLS-Beziehungen und Loeschregeln.
Es werden keine Login-Zugangsdaten angelegt. Der bestehende BLS-Katalog und sein
Aktivstatus werden nicht veraendert. Alle Fixtures enden in `ROLLBACK`.
Vor der dauerhaften Anwendung wurden Migration und Check am 2026-11-10 auf
`makroklar-dev` gemeinsam innerhalb einer einzigen Transaction erfolgreich
ausgefuehrt und vollstaendig zurueckgerollt. Nach Anwendung ueber die CLI bestand
der eigenstaendige Check erneut. Die anschliessende Read-only-Pruefung bestaetigte
den Migrationseintrag, aktiviertes RLS, vier Owner-Policies und eine leere
Zutatentabelle. Es blieben keine Testkonten, Testmitgliedschaften, Testrestaurants
oder Testausgaben zurueck. Der BLS-Katalog enthaelt weiterhin eine aktive Ausgabe,
138 Definitionen, 7.140 Lebensmittel und 985.320 Werte; die aktive Ausgabe ist
unveraendert. Das prueft die Datenbankregeln; Auth-Anmeldung und HTTP-Aufrufe aus
der Oberflaeche sind noch nicht Teil dieses Checks.
Zum erneuten Pruefen nach Anwendung der Migration:

```powershell
$checkFile = (Resolve-Path src/shared/supabase/checks/restaurant_ingredients.sql).Path
npm.cmd run supabase -- db query --file $checkFile --remote
```

Diese Migration enthaelt noch keine Gerichte, Rezeptmengen, Berechnungen oder
Open-Food-Facts-Zuordnung. Die Auth- und Zutatenoberflaechen werden separat angebunden.

## Gerichte und Rezeptmengen

`migrations/20261110000200_create_dishes.sql` wurde am 2026-11-10 ueber die CLI
auf `makroklar-dev` angewendet; der Migration-History-Eintrag wurde anschliessend
bestaetigt. Beide neuen Tabellen sind noch leer:

| Tabelle | Inhalt |
| --- | --- |
| `dishes` | Stabile UUID, Restaurant, lokaler Name, Anzahl der Rezeptportionen, optionale Quellidentitaet und Erstellungszeitpunkt. |
| `dish_ingredients` | Restaurant, Gericht, Restaurant-Zutat und deren Menge in Gramm fuer das gesamte Rezept. |

`servings` ist standardmaessig 1 und muss eine positive, endliche ganze Zahl sein.
Der Typ ist `numeric` mit Ganzzahl-Check, damit Bruchteile nicht still in einen
Integer gerundet werden. `quantity_g` ist eine positive, endliche `numeric`-Zahl;
Dezimalmengen wie 125,5 g bleiben erhalten. Die Menge gilt fuer das ganze Rezept,
nicht fuer jede einzelne Portion. Milliliter und Stueckzahlen benoetigen spaeter
ausdrueckliche Umrechnungen. Gerichte duerfen als Entwurf noch ohne Zutaten existieren.

Ein manuelles Gericht hat `source = NULL` und `source_id = NULL`. Ein importiertes
Gericht speichert das vorhandene Quellkennzeichen `lightspeed-k-series` und die
Original-ID als Text, zum Beispiel `String(importedItem.sourceId)`. Die beiden
Felder muessen gemeinsam gesetzt sein. Die Kombination Restaurant/Quelle/Quell-ID
ist eindeutig; mehrere manuelle Gerichte sind moeglich. Quellenidentitaet,
Restaurant-ID, UUID und Zeitstempel koennen Clients nach dem Anlegen nicht aendern.
Namen und Portionenzahl sind fuer Besitzer editierbar. Preise und deren Auswahl
werden durch diese Migration nicht veraendert; die Importoberflaeche speichert
weiterhin ihren bisherigen temporaeren Context.

Jede Zutat darf pro Gericht nur einmal vorkommen; ihre gesamte Rezeptmenge wird
in einer Zeile gespeichert. Clients koennen diese Menge aendern oder die Zeile
entfernen und eine neue Zuordnung anlegen. Zusammengesetzte Fremdschluessel ueber
`restaurant_id` stellen sicher, dass Gericht und Zutat zum selben Restaurant
gehoeren, auch wenn ein Konto mehrere Restaurants besitzt. Dafuer fuegt die neue
Migration einen Unique-Constraint `(restaurant_id, id)` zu `restaurant_ingredients`
hinzu; die bereits angewendete Zutaten-Migration bleibt unveraendert.

Beim Loeschen eines Gerichtes werden seine Rezeptzeilen entfernt, die Zutaten
des Restaurants bleiben erhalten. Das Loeschen einer noch verwendeten Zutat
scheitert spaetestens beim COMMIT, solange ihre Rezeptreferenzen nicht in derselben
Transaction entfernt werden. Ihr Fremdschluessel
verwendet `NO ACTION DEFERRABLE INITIALLY DEFERRED`: Die Referenz muss spaetestens
beim COMMIT gueltig sein. Damit kann eine administrative Loeschung des ganzen
Restaurants Gerichte, Rezeptzeilen und Zutaten in beliebiger Cascade-Reihenfolge
entfernen. Ein einzelner Client-Request zum Loeschen einer verwendeten Zutat
scheitert beim Abschluss seiner Transaction. Der SQL-Check erzwingt diese
Pruefung explizit mit `SET CONSTRAINTS ... IMMEDIATE`, da er selbst mit ROLLBACK
endet. Acht Owner-Policies und explizite Spaltenrechte schuetzen beide Tabellen.
Besucher erhalten keinen Zugriff; `service_role` hat administrative CRUD-Rechte.

`checks/dishes.sql` prueft mit rueckrollbaren Fixtures unter anderem mehrere
Restaurants je Besitzer, fremde Zugriffe, gemischte Restaurantreferenzen,
Import-Duplikate, geschuetzte Spalten, ungueltige Mengen/Portionen, Dezimalwerte
und die verschiedenen Loeschregeln. Der bestehende BLS-Katalog wird nicht veraendert.
Vor der dauerhaften Anwendung wurden Migration und Check am 2026-11-10 auf
`makroklar-dev` innerhalb einer einzigen Transaction erfolgreich ausgefuehrt
und vollstaendig zurueckgerollt. Der bestehende Check `restaurant_ingredients.sql`
bestand ebenfalls mit dem neuen Schema innerhalb einer rueckrollbaren Transaction.
Nach Anwendung ueber die CLI bestanden beide eigenstaendigen SQL-Checks erneut.
Eine anschliessende Read-only-Pruefung bestaetigte den Migrationseintrag, den
neuen Zutaten-Unique-Constraint, aktiviertes RLS und je vier Owner-Policies auf
beiden neuen Tabellen sowie den auf COMMIT verschiebbaren Zutaten-Fremdschluessel.
Gerichte, Rezeptzeilen und Restaurant-Zutaten sind weiterhin leer; es blieben keine
Testkonten, Testrestaurants oder Testausgaben zurueck. Der BLS-Katalog enthaelt
unveraendert eine aktive Ausgabe, 138 Definitionen, 7.140 Lebensmittel und 985.320
Werte. Diese Checks pruefen SQL-Regeln, keine Auth-Anmeldung oder HTTP-Aufrufe
aus der Oberflaeche.
Zum erneuten Pruefen nach Anwendung der Migration:

```powershell
$checkFile = (Resolve-Path src/shared/supabase/checks/dishes.sql).Path
npm.cmd run supabase -- db query --file $checkFile --remote
```

Dieser Schritt enthaelt noch keine Nährwertberechnung, Rezeptveroeffentlichung,
Preispersistenz oder Anbindung an die Oberflaeche. Ein leeres/unvollstaendiges Rezept
bedeutet nicht, dass seine Nährwerte null sind. Spaetere Berechnungen muessen auch
die bereits gespeicherten BLS-Marker fuer fehlende Werte und Messgrenzen erhalten.

Referenz: [PostgreSQL-Fremdschluessel und Loeschregeln](https://www.postgresql.org/docs/17/ddl-constraints.html).

## Nährwerte berechnen

`migrations/20261110000300_add_dish_nutrition.sql` wurde am 2026-11-10 ueber die CLI
auf `makroklar-dev` angewendet; der Migration-History-Eintrag wurde anschliessend
bestaetigt. `public.get_dish_nutrition(target_dish_id uuid)` berechnet die Werte
eines lesbaren Gerichtes bei jedem Aufruf aus den gespeicherten Rezeptmengen
und genau den BLS-Ausgaben seiner Restaurant-Zutaten.
Es werden keine berechneten Summen gespeichert oder Quellwerte veraendert.

| BLS-Code | Inhalt | Einheit |
| --- | --- | --- |
| `ENERCC` | Energie aus dem vorhandenen BLS-Wert | kcal |
| `PROT625` | Protein (Nx6,25) | g |
| `FAT` | Fett | g |
| `CHO` | Verfuegbare Kohlenhydrate | g |

Je Metrik gilt `Rezeptwert = SUM(BLS-Wert * quantity_g / 100)` und
`Portionswert = Rezeptwert / servings`. Es werden `numeric`-Werte ohne
vorzeitiges `ROUND` oder Float-Konvertierung verwendet. Die Energie wird aus
`ENERCC` gelesen, nicht aus einer vereinfachten Makroformel rekonstruiert.
Die Bezugsmenge des BLS-Katalogschemas ist fest auf 100 g gesetzt.

Die Funktion liefert fuer ein sichtbares Gericht vier Zeilen, in obiger Reihenfolge:

| Rueckgabefeld | Bedeutung |
| --- | --- |
| `nutrient_code`, `unit` | BLS-Code und erwartete Einheit. |
| `recipe_total`, `per_serving` | Summe fuer das Rezept und eine Portion; bei unvollstaendigen/fehlenden Rezeptdaten `NULL`. |
| `status` | `complete`, `incomplete` oder `empty_recipe`. |
| `ingredient_count`, `known_ingredient_count` | Anzahl der Rezeptzutaten und davon fuer diese Metrik auswertbare Zutaten. |
| `issues` | JSON-Liste mit betroffener Zutat, BLS-Referenz, Grund, Originalmarker und Einheiten; sonst `[]`. |

Jede Metrik wird getrennt bewertet. Nur wenn alle Zutaten einen numerischen
Wert in der erwarteten Einheit besitzen, werden Summe und Portionswert geliefert.
Echte numerische Nullwerte bleiben gueltig. `missing`, `trace`, `below_lod`,
`below_loq` und `below_lod_or_loq` bleiben als Gruende mit `value_kind` und
unveraendertem `raw_value` sichtbar; sie werden nicht als Null oder Schaetzung
verrechnet. Fehlende Wertzeilen, Definitionen oder falsche Einheiten liefern
`missing_value`, `missing_definition` beziehungsweise `unit_mismatch`.
Unaufgeloeste oder durch RLS unsichtbare Zutaten werden als `missing_ingredient`
gezaehlt; ihre privaten Details werden nicht geliefert. Eine teilweise bekannte
Summe wird nicht als vollstaendiger Wert ausgegeben. Leere Rezepte liefern
`empty_recipe`, unbekannte Summen und eine leere Issues-Liste.

Die Funktion ist `STABLE SECURITY INVOKER` mit leerem `search_path`. Sie nutzt
die vorhandenen SELECT-Rechte und RLS-Policies des Aufrufers; `authenticated`
und vertrauenswuerdiges `service_role` haben explizites EXECUTE, `PUBLIC` und
`anon` nicht. Ein fremdes, nicht vorhandenes oder ohne Benutzeridentitaet
abgefragtes Gericht liefert fuer `authenticated` keine Zeilen. Dies unterscheidet
sich vom eigenen leeren Rezept, das vier Zeilen mit `empty_recipe` liefert.
Eine spaetere oeffentliche Gast-Speisekarte braucht einen eigenen freigegebenen
Lese-/Veroeffentlichungsablauf.

`checks/dish_nutrition.sql` prueft mit komplett rueckrollbaren Fixtures bekannte
Summen, Dezimalmengen, geaenderte Portionen, alle BLS-Marker, echte Nullwerte,
leere Rezepte, fehlende Zeilen/Definitionen, falsche Einheiten, versionsgebundene
Werte und Zugriffstrennung. Voruebergehend ungueltige Zutatenreferenzen werden
vor dem abschliessenden Constraint-Check entfernt. Der echte BLS-Katalog bleibt
unveraendert. Vor der dauerhaften Anwendung wurden Migration und Check am
2026-11-10 gemeinsam innerhalb einer Transaction auf `makroklar-dev` erfolgreich
geprueft und vollstaendig zurueckgerollt. Nach Anwendung ueber die CLI bestand
der eigenstaendige Check erneut. Die Read-only-Nachpruefung bestaetigte den
Migrationseintrag und `STABLE SECURITY INVOKER` mit leerem `search_path` sowie
EXECUTE fuer `authenticated` und `service_role`, ohne EXECUTE fuer `anon`.
Gerichte, Rezeptzeilen und Restaurant-Zutaten sind weiterhin leer. Es blieben
keine Testkonten, Testrestaurants oder Testausgaben zurueck. Der BLS-Katalog
enthaelt unveraendert eine aktive Ausgabe, 138 Definitionen, 7.140 Lebensmittel
und 985.320 Werte. Der Check deckt Datenbanklogik und Rollen ab, keine echte
Auth-Anmeldung oder HTTP-/Frontend-Anbindung. Zum erneuten Pruefen:

```powershell
$checkFile = (Resolve-Path src/shared/supabase/checks/dish_nutrition.sql).Path
npm.cmd run supabase -- db query --file $checkFile --remote
```

Die Berechnung folgt den eingegebenen Mengen und der ausgewaehlten BLS-Zubereitungsform.
Garverluste, Ausbeuten und Umrechnungen von ml/Stueck sind nicht implementiert.
Ebenso fehlen noch Auth-/HTTP-Anbindung, Frontend-Anzeige und gespeicherte
Veroeffentlichungs-Snapshots. Die bisherigen Importdaten liegen weiterhin nur
im temporaeren Context der Oberflaeche.

Referenzen: [Supabase-Funktionen und Zugriffsrechte](https://supabase.com/docs/guides/database/functions),
[PostgreSQL-Aggregate](https://www.postgresql.org/docs/17/functions-aggregate.html).

## Verifikation und weitere Migrationen

Die lokale CLI-Konfiguration ist vorbereitet. Die Migration setzt eine Supabase-Datenbank mit
Auth-Schema und den Standardrollen voraus; sie ist kein Setup fuer einen leeren,
beliebigen Postgres-Server. Die Registrierungsoberflaeche ist noch nicht angebunden.

Vor weiteren Anwendungen das Zielprojekt pruefen und die ausstehenden
Migrationen mit `npm.cmd run supabase -- db push --dry-run --skip-vault --remote`
anzeigen. Die Migrationen ueber die CLI anwenden, damit die Migration History
mitgefuehrt wird. Danach `checks/restaurant_foundation.sql` vollstaendig als
`postgres` ausfuehren. Die Pruefung legt innerhalb einer Transaktion zwei Testkonten ohne
Login-Zugangsdaten an und prueft erlaubte eigene Zugriffe, gesperrte fremde Zugriffe,
gesperrte direkte Eigentumszuweisung und Besucherzugriffe. Abschliessendes
`ROLLBACK` entfernt saemtliche Testdaten. Bei einem Fehler ebenfalls `ROLLBACK`
ausfuehren und den Fehler vor einer weiteren Anwendung klaeren.

Diese Pruefung ist ein normales SQL-Skript, kein pgTAP-Test fuer `supabase test db`.
Sie wurde am 2026-11-09 mit CLI `3.1.0` auf `makroklar-dev` erfolgreich ausgefuehrt:
eigene Zugriffe funktionieren; fremde Zugriffe, direkte Eigentumszuweisungen,
geschuetzte ID-Aenderungen und Besucherzugriffe werden blockiert. Eine anschliessende
Read-only-Abfrage bestaetigte RLS auf allen drei Tabellen, die sechs Policies
und dass keine Testkonten, Testprofile, Mitgliedschaften oder Restaurants uebrig sind.
Ein erfolgreicher SQL-Check prueft die Datenbankregeln, nicht den spaeteren Auth-
und HTTP-Ablauf im Frontend.

Zum erneuten Pruefen auf einem verknuepften Entwicklungsprojekt, aus dem Repository:

```powershell
$checkFile = (Resolve-Path src/shared/supabase/checks/restaurant_foundation.sql).Path
npm.cmd run supabase -- db query --file $checkFile --remote
```

Zugangsdaten und geheime Schluessel gehoeren nicht in dieses Verzeichnis oder in Git.

Referenzen:
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database functions](https://supabase.com/docs/guides/database/functions)
