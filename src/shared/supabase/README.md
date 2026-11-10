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
| `proxy.ts` | Prueft/erneuert die Session und reicht aktualisierte Cookies und Cache-Header weiter. |
| `config.ts` | Liest und prueft die beiden oeffentlichen Einstellungen erst bei einem Client-Aufruf. Fehlende Werte blockieren nicht schon den Modulimport. |
| `database.generated.ts` | Unveraenderte, per CLI erzeugte Typen des oeffentlichen Schemas einschliesslich Tabellen, Beziehungen und RPCs. |
| `database.types.ts` | Exportiert den verwendeten `Database`-Typ und korrigiert die nullable Ergebnisse von `get_dish_nutrition`. |

Importe erfolgen gezielt aus `@/shared/supabase/client` oder
`@/shared/supabase/server`; der Server-Client verwendet Next.js `cookies()`.
Registrierung und Login verwenden den Server-Client fuer `auth.signUp()` bzw.
`auth.signInWithPassword()`. Routenabsicherung ist noch nicht angebunden. Der abgestimmte zentrale
Einstieg `src/proxy.ts` laesst den Session-Refresh ausschliesslich fuer
`/business/:path*` laufen. Landing-, Gast- und Asset-Routen sind nicht im Matcher.
Der Proxy verwendet `auth.getClaims()`, um eine vorhandene Session zu pruefen
und gegebenenfalls zu erneuern. Ohne Session bleibt die oeffentliche Business-
Registrierungsseite erreichbar; es werden noch keine Login-Redirects eingefuehrt.
Dies ist Session-Pflege, keine alleinige Autorisierung fuer private Daten.
Spaetere geschuetzte Seiten/Server Actions muessen die Identitaet ebenfalls
pruefen; Datenbankrechte und RLS bleiben zusaetzlich wirksam.

### Registrierung und Bestaetigungs-Callback

`src/areas/business/components/auth/RegistrationForm.tsx` sendet das bestehende
Formular mit `useActionState` an `auth/registrationAction.ts`. Die Server Action
validiert ueber `auth/registration.ts` Restaurantname, E-Mail, Passwort und
Zustimmung und ruft erst danach `auth.signUp()` auf. Die Passwortanforderungen
bestimmt Supabase Auth. Passwort, Session und rohe SDK-Fehler werden nicht im
zurueckgegebenen Formularzustand gespeichert oder protokolliert.

`options.data.restaurant_name` speichert den Restaurantnamen als Auth-User-Metadatum.
Das ist noch kein `restaurants`-Datensatz und kein Berechtigungsnachweis.
Bei erforderlicher E-Mail-Bestaetigung erscheint eine neutrale Nachricht im
bisherigen Formular; es erfolgt noch kein Redirect zum Onboarding. Der Button ist
waehrend der Anfrage und nach einer erfolgreichen Antwort deaktiviert.

Die Server Action setzt `emailRedirectTo` auf `/business/auth/callback` am Origin
des Formular-Requests. Next.js prueft Origin/Host von Server Actions; Supabase
prueft zusaetzlich seine Redirect-Allowlist. Es wird keine neue Site-URL-Variable
eingefuehrt. Der Callback tauscht `code` ueber `exchangeCodeForSession` aus
(einschliesslich optionalem `sb_flow_id`), prueft den Nutzer mit `getUser()` und
ruft erst fuer einen Nutzer mit bestaetigter E-Mail den folgenden RPC auf.
Erst nach erfolgreicher Einrichtung folgt der feste Redirect `/business/welcome`.
Ein `next`-/`redirect_to`-Parameter wird nicht als Ziel verwendet. Redirects
behalten die Session-Cookies und SDK-Cache-Header; Responses sind `no-store`
und senden `Referrer-Policy: no-referrer`.

Die Migration `20261110000400_complete_restaurant_registration.sql` wurde am
2026-11-10 nach Freigabe ueber die CLI auf `makroklar-dev` angewendet. Die CLI
hatte im Dry-run genau diese eine Migration angezeigt; der Eintrag in der
Migration History und die angelegte Funktion wurden anschliessend bestaetigt. Der RPC
`complete_restaurant_registration()` erwartet keine Argumente. Er prueft
`auth.uid()` und die bestaetigte E-Mail in `auth.users`, serialisiert Aufrufe
pro Konto mit einem Transaction Advisory Lock und liefert das bereits vorhandene
aelteste eigene Restaurant zurueck (bei gleichem Zeitpunkt nach UUID sortiert).
Ohne bestehende Mitgliedschaft erstellt er Restaurant und Owner ueber die
vorhandene atomare Funktion. Das Metadatum `restaurant_name` liefert nur den
Anzeigenamen; Rolle und Besitzer werden daraus niemals uebernommen. Bestehende
Restaurants werden weder umbenannt noch dupliziert. Das Anlegen zusaetzlicher
Restaurants ueber `create_restaurant(text)` bleibt separat moeglich.

Bei fehlgeschlagenem RPC bleibt die Session erhalten. Im bisherigen Formular
erscheint `Einrichtung erneut versuchen`, das den Callback ohne Code erneut
aufruft und die Identitaet erneut prueft. Ungueltige/verbrauchte Links zeigen
eine feste Fehlermeldung; Provider-Details und Tokens werden nicht reflektiert.
Bei sofortiger Session nach `signUp` wird derselbe Callback verwendet.

Vor dem manuellen Gesamttest im gehosteten Dashboard unter Authentication / URL
Configuration pruefen bzw. fuer die lokale Entwicklung einstellen:

- Site URL: `http://localhost:3000`.
- Redirect URLs: `http://localhost:3000/business/auth/callback`.
- Falls tatsaechlich genutzt, zusaetzlich exakt `http://127.0.0.1:3000/business/auth/callback`.
- Unter Emails / Confirm signup muss der Bestaetigungslink `{{ .ConfirmationURL }}`
  verwenden, damit Auth nach der Verifikation mit dem PKCE-Code weiterleitet.

Diese gehosteten Einstellungen wurden hier nicht eingesehen oder geaendert.
`config.toml` konfiguriert die lokale CLI-Instanz, nicht automatisch das gehostete
Projekt. Link im selben Browser/Profil und mit demselben Hostnamen oeffnen, in
dem die Registrierung erfolgte: PKCE benoetigt den Verifier-Cookie. Die Migration
ist angewendet; die gehosteten URL-/E-Mail-Einstellungen und ein manueller Test
mit echter Bestaetigung sind weiterhin zu pruefen.
Geschuetzte Onboarding-Routen sind weiterhin ein eigener Schritt.

`database.generated.ts` wurde anschliessend ueber die CLI aus dem tatsaechlichen
oeffentlichen Schema neu erzeugt und enthaelt jetzt den RPC-Vertrag. Der
temporaere Eintrag wurde aus `database.types.ts` entfernt; dort bleibt nur die
weiterhin erforderliche Korrektur der nullable Naehrwert-Ergebnisse.

`node --test src/areas/business/auth/registration.test.mjs` prueft Validierung,
Payload, Fehlermeldungen und vertraulichen Formularzustand mit simuliertem
`signUp`. Diese Tests senden keine E-Mails und erstellen keine Konten.

`node --test src/areas/business/auth/registrationCallback.test.mjs` prueft mit
simulierten SDK-Antworten den Code-Austausch, verifizierte Identitaet, feste
Redirects, Fehler, erhaltene Header und Session-Wiederaufnahme.
`checks/restaurant_registration.sql` prueft mit zurueckgerollten Fixtures die
wiederholte Ausfuehrung, Metadatenvalidierung, Rechte, bestaetigte Identitaet und
Mandantentrennung. Am 2026-11-10 wurden die noch ausstehende Migration und dieser
Check zusammen in einer Transaktion auf `makroklar-dev` ausgefuehrt und danach
vollstaendig zurueckgerollt. Weder Funktion noch Fixtures blieben bei diesem
Vorab-Test gespeichert. Nach der dauerhaften Anwendung bestand derselbe SQL-Check
erneut gegen die installierte Funktion; die Testdaten wurden zurueckgerollt und
die Anzahlen von Auth-Nutzern, Restaurants und Mitgliedschaften blieben unveraendert.
Ein echter paralleler Zwei-Request-Test steht noch aus; der SQL-Check verifiziert
den gehaltenen Advisory Lock und sequenzielle Wiederholungen.

TypeScript und der Produktionsbuild bestanden ebenfalls. Ein separater lokaler
Produktionsserver wurde mit ausschliesslich simulierten Supabase-Netzwerkantworten
geprueft: Der echte SSR-SDK-Code tauschte einen synthetischen Code aus und schrieb
Session-Cookies ueber Next.js' Cookie-Store. Die Cookies erreichten auch bei einem
simulierten RPC-Fehler die Redirect-Response; mit ihnen gelang die Wiederaufnahme
ohne erneuten Auth-Code bis zum festen Welcome-Ziel. Der Fehlerbildschirm bot
keine zweite Registrierung an. Ein ungueltiger Link wurde lokal und ohne
Provider-Details weitergeleitet. Kein echter Signup, E-Mail-Versand oder
dauerhafter Datenbankeintrag war Teil dieses HTTP-Tests; der Testserver wurde beendet.

Referenzen: [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[E-Mail-Vorlagen](https://supabase.com/docs/guides/auth/auth-email-templates).

### Login fuer bestaetigte Restaurantkonten

`/business/login` bindet `src/areas/business/LoginPage.tsx` ein. Die Seite und
`components/auth/LoginForm.tsx` verwenden bewusst die CSS-Module-Klassen des
bestehenden Registrierungskarts, einschliesslich Farben, Abstaenden und Radius.
Der bisher deaktivierte Login-Link in der Registrierung fuehrt jetzt hierher.
Es gibt keine neuen Design-Token, Abhaengigkeiten oder Datenbankaenderungen.

`auth/login.ts` validiert E-Mail und Passwort. `auth/loginAction.ts` ruft erst
bei gueltigen Feldern `signInWithPassword()` auf; Passwoerter werden nicht
getrimmt, gespeichert oder protokolliert. Der zurueckgegebene Formularzustand
enthaelt nur E-Mail, Status und sichere Fehlermeldungen, keine Session/Token.
Falsche Zugangsdaten erhalten dieselbe Meldung, unabhaengig davon, ob das Konto
existiert. Unbestaetigte E-Mail und Rate-Limits werden verstaendlich angezeigt.

Nach erfolgreichem Login schreibt der bestehende SSR-Client die Session-Cookies
und die Server Action leitet fest auf `/business/auth/callback` weiter. Dort
wird die Identitaet erneut ueber `getUser()` geprueft und die bestehende RPC-Funktion
verwendet, bevor `/business/welcome` folgt. Dadurch koennen bestaetigte Konten
auch nach einem verbrauchten Bestaetigungslink ihre Restaurant-Einrichtung
fortsetzen. Ein schon vorhandenes Restaurant wird wiederverwendet; bei einem
RPC-Fehler bleibt die bekannte Wiederaufnahme ueber den Registrierungskart erhalten.

Manueller Test: Entwicklungsserver starten, `/business/login` oeffnen und mit
einem selbst bestaetigten Restaurantkonto anmelden. Die echte Anmeldung und
Restaurant-Erstellung werden vom Nutzer ausgefuehrt. Automatisierte Tests
verwenden ausschliesslich synthetische Zugangsdaten und simulierte Auth-Antworten.

`node --test src/areas/business/auth/login.test.mjs` prueft Validierung,
unveraenderte Passwort-Whitespace, neutrale Credential-Fehler, unbestaetigte
E-Mail, Rate-Limits, fehlende Session, vertraulichen Formularzustand und den
festen Server-Action-Redirect. Zusammen mit Registrierung, Callback und Proxy
bestanden am 2026-11-10 alle 32 Tests, TypeScript und der Produktionsbuild.
Ein isolierter Produktionsserver auf `localhost` pruefte zusaetzlich ueber HTTP
die Formular-Links, ungueltige Eingaben und falsche Passwoerter. Mit simulierten
Supabase-Netzwerkantworten schrieb der echte SDK nach einem erfolgreichen
Password-Login Session-Cookies; diese erreichten den Callback und die gepruefte
Weiterleitung nach `/business/welcome`. Passwort und rohe Provider-Fehler standen
nicht im Fehler-HTML. Der Testserver wurde beendet. Es gab keinen echten Login,
E-Mail-Versand oder Datenbank-Schreibvorgang durch diese Tests.

Referenz: [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

### Bereits angemeldet und Abmelden

Register und Login pruefen jetzt serverseitig ueber
`src/areas/business/auth/authPageAccount.ts` und `auth.getUser()` den Anmeldestatus.
Ein angemeldetes Konto sieht `AccountStatusPage.tsx`: die verifizierte eigene
E-Mail-Adresse, Weiter und Abmelden, statt eines weiteren Auth-Formulars.
Nur die E-Mail wird an diese Ansicht gegeben, keine Token, User-ID oder kompletten
User-Metadaten. Die dynamischen Responses sind privat und werden nicht gecacht.
Bei Auth-Verbindungsfehlern erscheint eine Wiederholungsmoeglichkeit statt eines
scheinbar ausgeloggten Formulars. Fehlende/ungueltige Sessions erhalten die
bisherigen anonymen Formulare. Der Weiter-Link nutzt den bestehenden Callback;
bei einem Setup-Fehler bleibt die idempotente Wiederaufnahme verfuegbar.

`components/auth/LogoutButton.tsx` steht im Account-Kart von Register und Login.
Auf Welcome bleibt das Logo ohne Abmeldebutton. `auth/logoutAction.ts` verwendet
ausdruecklich `signOut({ scope: 'local' })`.
Der SSR-Client entfernt die Cookies der aktuellen Browser-Session; andere
Geraete bleiben angemeldet. Die aktuelle SDK-Version entfernt bei diesem Scope
zuerst den lokalen Zustand und versucht danach die Remote-Revocation. Falls nur
dieser Remote-Versuch scheitert, prueft die Action mit `getSession()` ausschliesslich
den lokalen Speicherzustand. Ist dieser leer, kann die lokale Abmeldung trotzdem
abgeschlossen werden. Das ist keine Verwendung von `getSession()` zur Autorisierung.

Nach bestaetigter lokaler Abmeldung ruft `auth/logout.ts` zuerst `resetDraft()`
auf und danach `window.location.replace('/business/login')`. Dadurch werden
importierte Mock-Artikel und ausgewaehlte Einkaufsquellen entfernt und die
Client-Ansicht neu geladen. Die asynchrone Client-Aktion beendet diese Schritte
auch dann, wenn Next.js nach dem Cookie-Update den Account-Kart bereits durch
das Login-Formular ersetzt hat. Bei einer fehlgeschlagenen, nicht bestaetigten
Abmeldung bleiben Draft und Seite erhalten. Der Button braucht JavaScript.
Gespeicherte Restaurants und Mitgliedschaften werden nicht geloescht.

`node --test src/areas/business/auth/accountAccess.test.mjs` prueft die verifizierte
Account-Ansicht, Auth-Ausfaelle, lokalen Logout-Scope, Remote-/Storage-Fehler und
die Reihenfolge Server-Bestaetigung, Draft-Reset, Navigation. Zusammen mit den
bestehenden Auth-/Proxy-Tests bestanden alle 43 Tests, TypeScript und der Build.
Ein isolierter Produktionsserver mit simulierten Supabase-Netzwerkantworten
pruefte per HTTP die anonymen Formulare, Account-Karten mit eigener E-Mail ohne
Auth-Felder, privaten Cache-Header und Setup-Wiederaufnahme.
Der echte Logout-Server-Action-Aufruf loeschte die echten SDK-Session-Cookies;
anschliessend zeigten Register und Login wieder anonyme Formulare ohne E-Mail.
Keine echte Benutzer-Session wurde bei diesen Tests beendet; es wurden keine
Konten, E-Mails oder Datenbank-Schreibvorgaenge erzeugt. Der Testserver wurde beendet.

Manueller Test: Angemeldet Register und Login oeffnen, E-Mail/Weiter pruefen und
Abmelden druecken. Erwartet wird das anonyme Login-Formular. Beim erneuten Login
wird derselbe bestehende Restaurant-Datensatz wiederverwendet. Die allgemeine
Absicherung von Welcome/Onboarding und die Reihenfolge der Onboarding-Schritte
sind nicht Bestandteil dieses Schritts.

Referenzen: [getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[signOut und Scope](https://supabase.com/docs/reference/javascript/auth-signout).

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
bei schreibgeschuetzten Server Components bleibt der Refresh Aufgabe des
Proxy. Andere Cookie-Fehler werden weitergegeben. In Route Handlers die eigenen
ausgehenden `response.headers` an `createClient(response.headers)` uebergeben und
dieselbe Response zurueckgeben, damit die vom SDK gelieferten privaten Cache-Header
mit den Auth-Cookies ausgegeben werden. Der Proxy sammelt alle Cookie-Aenderungen
und Cache-Header eines Requests und erzeugt erst nach `getClaims()` die Response.
So erreichen die aktuellen Cookies sowohl das nachfolgende Server-Rendering als
auch den Browser. Mehrere SDK-`setAll`-Aufrufe behalten bereits gelieferte Cache-
Header; Cookie-Loeschungen und Attribute werden weitergegeben. Die SDK-Cache-
Header verhindern das Caching einer Response mit erneuerten Session-Cookies.
Identitaet wird ueber `auth.getClaims()`/`getUser()` geprueft; rohe Session-Cookies
sind kein Berechtigungsnachweis.

Die beiden oeffentlichen Umgebungsvariablen sind fuer Business-Requests mit
Proxy auf jedem Entwicklungsrechner und im Deployment erforderlich. Ein neuer
Server-Client wird je Request erstellt. Der Proxy verwendet keine administrative
Datenbankverbindung und legt keine Konten an.

`node --test src/shared/supabase/proxy.test.mjs` prueft den Matcher mit Next.js'
installierter Matcher-Testfunktion und die echten NextRequest/NextResponse-
Klassen mit simulierten SDK-Ereignissen. Abgedeckt sind anonyme Requests,
mehrere Refresh-Batches, Cookie-Attribute/-Loeschung, weitergegebene Request-
Cookies und Cache-Header sowie unerwartete SDK-Fehler. Das Testskript verwendet
synthetische Einstellungen und erzeugt keine Netzwerkrequests oder Konten.

Am 2026-11-10 bestanden alle vier Proxy-Tests, TypeScript und der Produktionsbuild.
Next.js erkannte den zentralen Proxy. Ein anschliessender HTTP-Smoke-Test mit
einem separat gestarteten lokalen Produktionsserver pruefte ohne Anmeldung
`/business/register`, `/business/onboarding/menu`, `/business/onboarding/purchases`,
`/` und `/guest`: jeweils 200, keine Redirects oder Session-Cookie-Schreibvorgaenge
und keine nach aussen gelangten internen Request-Override-Header. Der Testserver
wurde anschliessend beendet. Es wurden keine Konten angelegt. Ein tatsaechlicher
Token-Refresh mit einer angemeldeten Sitzung steht noch aus und wird nach
Anbindung von Registrierung/Login geprueft.

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
beliebigen Postgres-Server. Das Registrierungsformular sendet Auth-Anfragen;
die wiederholbar sichere Restaurant-Erstellung nach Bestaetigung ist mit der
angewendeten Migration `20261110000400` verfuegbar.

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
