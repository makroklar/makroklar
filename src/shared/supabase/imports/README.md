# BLS-Import

Einmaliges Entwicklungswerkzeug, getrennt von Next.js und den Oberflaechen.
Es importiert die gepruefte Ausgabe BLS 4.0 (2025) aus den Originaldateien.
Keine neuen Endpoints, kein automatischer Import beim App-Start.

## Datenmodell

Die neue Migration `../migrations/20261109000200_create_bls_catalog.sql`
wurde am 2026-11-10 auf `makroklar-dev` angewendet und mit dem SQL-Check geprueft.
Der Vollimport von BLS 4.0 (2025) wurde am selben Tag erfolgreich abgeschlossen.
Eine Ausgabe ist aktiv; die folgenden Mengen sind in der Datenbank vorhanden.

| Tabelle | Inhalt |
| --- | --- |
| `nutrition_datasets` | Version, Jahr, SHA-256-Identitaet, Dateimanifest, Quelle, Importzeit, Sollanzahlen und aktive Ausgabe. Bezugsmenge ist immer 100 g essbarer Anteil. |
| `nutrients` | 138 Definitionen je Ausgabe: Originalcode, DE-/EN-Namen, Einheit, Gruppen und Formeln als unveraenderter Text. |
| `bls_foods` | 7.140 Lebensmittel je Ausgabe mit Original-BLS-Code, DE-/EN-Namen, Quellzeile und optionalem Hinweis. |
| `bls_food_nutrients` | 985.320 Werte mit Originaldarstellung, Zustand, Datenherkunft und Referenz. |

Die Tabellen bilden einen gemeinsamen Referenzkatalog, keine Kopie je Restaurant.
Lebensmittel werden durch `(dataset_id, bls_code)` identifiziert, Nährstoffe durch
`(dataset_id, code)`. Beide Fremdschluessel der Wertetabelle enthalten die Ausgabe-ID,
damit sich verschiedene Ausgaben nicht versehentlich vermischen. Spaetere Zutaten
koennen auf genau diese Originalcodes und die verwendete Ausgabe verweisen.
Eine neue Ausgabe ersetzt keine alten Werte; erst nach vollstaendigem Import wird
sie als aktiv markiert. Pro Quelle ist hoechstens eine Ausgabe aktiv.

Nur angemeldete Konten duerfen den Referenzkatalog lesen. RLS ist auf allen vier
Tabellen aktiv. Clients haben keine Schreibrechte; `service_role` hat explizite
Schreibrechte fuer spaeteren vertrauenswuerdigen Backend-Code. Der Import selbst
verwendet eine administrative Postgres-Verbindung, keinen Browser-Schluessel.
Gast-Speisekarten und Open Food Facts sind nicht Bestandteil dieser Migration.

## Originalwerte bleiben unterscheidbar

| Excel-Wert | `value_kind` | `value` | `raw_value` |
| --- | --- | --- | --- |
| Zahl, auch `0` | `numeric` | Unveraenderter Zahlenwert | Dezimaldarstellung |
| Leere Zelle | `missing` | `NULL` | `NULL` |
| `-` | `missing` | `NULL` | `-` |
| `TR` | `trace` | `NULL` | `TR` |
| `<LOD` | `below_lod` | `NULL` | `<LOD` |
| `<LOQ` | `below_loq` | `NULL` | `<LOQ` |
| `<LOD or <LOQ` | `below_lod_or_loq` | `NULL` | `<LOD or <LOQ` |

Unbekannte Marker, negative/unendliche Zahlen oder unerwartete Excel-Strukturen
brechen den Import ab. Es gibt keine Nullersetzung, Schaetzung, Rundung oder
Berechnung aus Formeln. Mengenangaben beziehen sich auf 100 g; die Einheit steht
in `nutrients.unit` (`g`, `mg`, `µg`, `kJ` oder `kcal`). Fehlende oder begrenzte
Werte muessen auch bei spaeteren Rezeptberechnungen erkennbar bleiben.

## Erst ohne Datenbank pruefen

Voraussetzung ist Node.js >= 22.22 wie im Projekt-README. Aus dem Repository:

```powershell
npm.cmd run bls:import -- --dry-run
node --test src/shared/supabase/imports/bls-import.test.mjs
```

Ohne Optionen ist `bls:import` ebenfalls nur ein Dry-run. Dabei wird keine
Datenbankverbindung aufgebaut und keine `.env.local` geladen. Fuer einen anderen
Quellordner `--source-dir 'D:\Pfad\BLS'` ergaenzen.

Die Originaldateien liegen lokal in `/BLS/`, das Git ignoriert:

- `BLS_4_0_Daten_2025_DE.xlsx`
- `BLS_4_0_Components_DE_EN.xlsx`
- `BLS_4_0_Dokumentation_DE.pdf`

`bls-4.0-2025.manifest.json` legt Dateinamen, SHA-256-Pruefsummen und Sollanzahlen
fest. Alle drei Dateien werden vor und nach dem Lesen geprueft. Veraenderte oder
andere Ausgaben werden abgewiesen und benoetigen ein separat geprueftes Manifest.
Der Leser verarbeitet die grosse Lebensmitteltabelle als Stream; die App muss
keine Excel-Dateien einlesen. Originaldateien ausserhalb von Git aufbewahren,
auch nach dem Import: fuer Wiederherstellung, neue Entwicklungsprojekte und
Nachvollziehbarkeit werden sie weiterhin gebraucht.

ExcelJS `4.4.0` und pg `8.23.1` sind festgelegte `devDependencies` fuer dieses
Werkzeug. Nur innerhalb von ExcelJS ist `uuid` auf `11.1.1` ueberschrieben, um
GHSA-w5hq-g745-h8pq zu beheben. Die vollstaendige BLS-Lesung wurde mit dieser
Kombination geprueft. Andere Abhaengigkeitsbaeume werden nicht ueberschrieben.

## Bewusst importieren

Vor dem Vollimport den Speicherbedarf im Entwicklungsprojekt pruefen. Die knapp eine
Million Werte plus Indizes benoetigen deutlich mehr Platz als die komprimierten
Excel-Dateien. Das aktuelle Projektlimit vor dem Vollimport kontrollieren; der
tatsaechliche Speicherbedarf auf `makroklar-dev` betrug nach dem Vollimport
183.582.720 Bytes (175,1 MiB) fuer den Katalog einschliesslich Indizes.
Eine temporaere Stichprobe vom 2026-11-10 ergab rund 180 MiB fuer den Katalog
einschliesslich Indizes, beziehungsweise 234 MiB mit 30 Prozent Reserve.
Das ist eine Hochrechnung, keine garantierte Obergrenze; WAL, weitere Projekte
im Organisationskontingent und spaeteres Datenwachstum sind nicht enthalten.

Auf weiteren Entwicklungsprojekten zuerst die Migration ueber die Supabase CLI
anwenden. `../checks/bls_catalog.sql` kann danach vollstaendig ausgefuehrt werden.
Das SQL-Skript prueft
Constraints, Beziehungen, RLS und Rollenrechte mit kleinen Testdaten und endet
mit `ROLLBACK`. Bei Fehlern ebenfalls zurueckrollen und zuerst die Ursache klaeren.
Es ist kein pgTAP-Test und erstellt keine Login-Konten.

Fuer einen Import auf einem weiteren Rechner die Postgres-Verbindung aus Dashboard > Connect
lokal als `BLS_DATABASE_URL` in `.env.local` hinterlegen. Bei Verwendung des
Poolers die **Session**-Verbindung waehlen. Passwort nicht in Befehle, Git oder
Chat kopieren. Kein `NEXT_PUBLIC_`-Praefix verwenden. Die Datei ist bereits
ignoriert; das Skript legt sie nicht an und zeigt die Verbindungsdaten nicht an.

```powershell
npm.cmd run bls:import -- --apply --project-ref osdbsbbcnftussvgumjh
```

`--project-ref` wird mit dem Host bzw. Pooler-Benutzernamen abgeglichen; ohne
Parameter wird die lokale CLI-Verknuepfung gelesen. TLS-Zertifikate werden immer
verifiziert. Falls eine zusaetzliche vertrauenswuerdige CA noetig ist, ihren
lokalen Dateipfad in `BLS_SSL_ROOT_CERT` setzen. Zertifikatspruefung nicht abschalten.
URL-Optionen werden ausser `sslmode=require` / `verify-full` zurueckgewiesen;
auch bei `require` bleibt die Zertifikatspruefung aktiv.

Beim Verbindungstest wurde `SELF_SIGNED_CERT_IN_CHAIN` durch die offizielle
Supabase-CA behoben. Die Downloadadresse stammt aus der
[Dashboard-Konfiguration im offiziellen Repository](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json):
[Produktions-CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt).
Die CA wird lokal in `src/shared/supabase/.temp/prod-ca-2021.crt` gespeichert und
in `.env.local` referenziert:

```dotenv
BLS_SSL_ROOT_CERT="src/shared/supabase/.temp/prod-ca-2021.crt"
```

Beide lokalen Dateien sind von Git ausgeschlossen. Andere Teammitglieder laden
die CA selbst von der offiziellen Quelle; sie enthaelt keinen privaten Schluessel.
Der Verbindungstest bestaetigte Verschluesselung und erfolgreiche
Zertifikatspruefung. Zugangsdaten wurden nicht protokolliert.

Eine einzige Verbindung und Transaction umfasst Ausgabe, Definitionen und alle
Werte. Lebensmittel werden in Batches von 50 geschrieben; alle SQL-Werte sind
parametrisiert. Vor `COMMIT` werden Dateipruefsummen und Datenbankanzahlen erneut
geprueft. Bei Fehlern folgt `ROLLBACK`, die bisher aktive Ausgabe bleibt erhalten.
Ein transaktionsgebundener Advisory Lock verhindert parallele Importe durch
dieses Werkzeug. Eine bereits vorhandene Ausgabe mit gleicher Inhaltsidentitaet
wird nach Anzahlpruefung uebersprungen und nicht erneut aktiviert. Die Pruefsumme
identifiziert die Quelldateien; sie ist kein nachtraeglicher Hash aller DB-Zeilen.

## Verantwortlichkeiten und Tests

- `bls-reader.mjs`: Manifest, Dateipruefung, Excel-Spalten, Originalwerte und Stream.
- `import-bls.mjs`: CLI, Verbindung, SQL-Batches, Transaction und Wiederholbarkeit.
- `bls-import.test.mjs`: Node-Tests fuer Werte/Spalten, TLS/Zielprojekt,
  Wiederholbarkeit, Batches und Rollback mit simuliertem Datenbank-Client.
- `../checks/bls_catalog.sql`: echte Postgres-/RLS-Pruefungen, komplett rueckrollbar.

Die Node-Tests ersetzen keinen vollstaendigen pg-Import in Supabase. Der echte
Import und die anschliessenden Read-only-Pruefungen wurden am 2026-11-10 auf
`makroklar-dev` erfolgreich ausgefuehrt; Einzelheiten stehen unten.

Am 2026-11-09 erfolgreich geprueft:

- Vollstaendiger Dry-run der Originaldateien: 7.140 Lebensmittel, 138 Definitionen,
  985.320 Werte; davon 869.501 numerisch, 110.142 fehlend, 1.806 Spuren,
  2.733 unter LOD, 746 unter LOQ und 392 mit kombiniertem LOD-/LOQ-Marker.
- Sechs Node-Tests, TypeScript (`npx.cmd tsc --noEmit --incremental false`) und
  `npm.cmd audit` ohne gemeldete Schwachstellen.
- Migration und SQL-Check gemeinsam innerhalb EINER temporaeren Transaction auf
  `makroklar-dev`, gefolgt von `ROLLBACK`. Constraints, Fremdschluessel, eindeutige
  aktive Ausgabe, gemeinsame Leserechte, gesperrte Schreib-/Gastzugriffe und RLS
  bestanden. Eine anschliessende Read-only-Abfrage bestaetigte, dass die vier
  Tabellen und der BLS-Migrationseintrag weiterhin fehlen. Dies war keine
  dauerhafte Anwendung der Migration und kein Vollimport ueber pg.

Am 2026-11-10 wurde die Migration ueber die CLI dauerhaft auf `makroklar-dev`
angewendet. Der anschliessende SQL-Check bestand erneut und entfernte seine
Testdaten per `ROLLBACK`. Eine Read-only-Abfrage bestaetigte den Migrationseintrag,
aktiviertes RLS und je eine SELECT-Policy auf allen vier Tabellen sowie jeweils
null Zeilen. Zu diesem Zeitpunkt war der Vollimport noch nicht ausgefuehrt.

Danach wurde der echte pg-Schreibpfad mit 400 systematisch ueber die 7.140
Quellzeilen verteilten Lebensmitteln und allen 138 Definitionen getestet:
55.200 Werte. Dafuer wurden innerhalb einer Transaction vier TEMP-Tabellen
mit derselben Spaltenstruktur, Checks, Indizes und entsprechenden
Fremdschluesseln angelegt. Die SQL-Aufrufe des Importers wurden ausschliesslich
auf diese TEMP-Tabellen umgeleitet; sein abschliessendes COMMIT wurde im
Testadapter durch Messung und ROLLBACK ersetzt. Produktivtabellen wurden nicht
beschrieben. Die Stichprobe belegte 10.698.752 Bytes einschliesslich Indizes;
die Hochrechnung skaliert Lebensmittel und Werte mit 7.140 / 400 und behaelt
die Groesse der Ausgabe und Definitionen konstant: 188.350.055 Bytes
(179,6 MiB), mit 30 Prozent Reserve 233,5 MiB. Die aktuelle Projektdatenbank
belegte nach dem Test rund 11,3 MiB. Alle vier oeffentlichen Tabellen blieben
leer und es waren anschliessend keine TEMP-Tabellen mehr vorhanden.

Anschliessend wurde der freigegebene Vollimport mit dem normalen CLI-Befehl und
einem echten COMMIT ausgefuehrt. Bestaetigte Ergebnisse der Read-only-Pruefung:

- Genau eine aktive BLS-4.0-Ausgabe mit geprueftem Quellmanifest, Inhaltsidentitaet,
  Bezugsmenge 100 g, 7.140 Lebensmitteln, 138 Definitionen und 985.320 Werten.
- Die Anzahlen aller sechs Wertzustaende stimmen exakt mit dem Excel-Leser
  ueberein. Vier Hinweise aus der Lebensmitteltabelle sind vorhanden.
- Alle 138 Definitionen stimmen einschliesslich Einheiten, Gruppen und
  Formeltexten mit dem Original ueberein.
- 20 systematisch verteilte Lebensmittel mit 2.760 Werten wurden feldweise mit
  dem Original verglichen: Codes, Namen, Quellzeilen, Hinweise, Zahlenwerte,
  Originaldarstellungen, Zustaende, Datenherkunft und Referenzen stimmen ueberein.
- RLS ist weiterhin auf allen vier Tabellen aktiv, mit je einer SELECT-Policy.
- Der Katalog belegte 183.582.720 Bytes (175,1 MiB) einschliesslich Indizes,
  die Projektdatenbank insgesamt 195.221.171 Bytes (186,2 MiB). Diese Messung
  umfasst keine WAL-Dateien; sie ist keine Zusage zum gesamten Disk-Verbrauch.
- Der zweite unveraenderte CLI-Lauf meldete `already_imported` fuer dieselbe
  Ausgabe mit unveraenderten Anzahlen. Es wurde kein zweiter Datensatz importiert.

Zum manuellen Nachsehen im Supabase Table Editor `nutrition_datasets` und
`bls_foods` oeffnen. `bls_food_nutrients` verbindet die Lebensmittel ueber
`dataset_id` und `bls_code` mit den Definitionen in `nutrients`.
Beispiel: `C131000` ist Hafer, ganzes Korn, roh; `ENERCC` hat dort den Wert
343 kcal pro 100 g. Die vorhandenen Oberflaechen lesen diesen Katalog noch nicht.

Quellen: die drei Originaldateien im Manifest und [BLS](https://blsdb.de/),
[pg Transactions](https://node-postgres.com/features/transactions),
[pg TLS](https://node-postgres.com/features/ssl),
[uuid Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
