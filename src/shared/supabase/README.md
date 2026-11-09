# Supabase

Gemeinsame Datenbankstruktur und Zugriffsregeln fuer alle Bereiche von makroklar.

- `migrations/`: versionierte SQL-Dateien fuer Tabellen, Beziehungen, Grants und RLS-Policies.
- `checks/`: eigenstaendige SQL-Pruefungen, getrennt von den Migrationen.

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
