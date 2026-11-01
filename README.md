# makroklar

Klickbarer Prototyp für eine Nährwert-Speisekarte: Restaurants pflegen ihre Gerichte, Gäste sehen per QR-Code Kohlenhydrate (KE/BE), Makros und Allergene – vor allem für Menschen mit Diabetes, aber auch für Fitness & bewusste Ernährung.

> **Stand:** Grundgerüst mit leeren Platzhalterseiten auf Basis von [Next.js](https://nextjs.org/) (App Router). Noch kein Backend, keine echte Datenbank, keine Kassenanbindung – geplant sind Supabase als Datenbank und Vercel als Hosting.

## Voraussetzungen

- [Node.js](https://nodejs.org/) **22.22 oder neuer** (am einfachsten die aktuelle LTS-Version installieren)
- Git

Version prüfen:

```bash
node -v
```

## Projekt starten

```bash
git clone https://github.com/chiaradjml/makroklar
cd makroklar
npm install
npm run dev
```

Danach im Browser **http://localhost:3000** öffnen. Änderungen am Code werden sofort im Browser aktualisiert.

### Weitere Befehle

| Befehl          | Was passiert                                             |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Entwicklungsserver starten                               |
| `npm run build` | TypeScript prüfen und fertige Version in `.next/` bauen  |
| `npm run start` | Gebaute Version aus `.next/` lokal starten               |

## Seiten im Prototyp

Alle Seiten sind aktuell Platzhalter. Jeder Bereich hat sein eigenes Layout: Die Landingpage hat Header und Footer als pinke Platzhalter-Blöcke, die Layouts von Restaurant- und Gastansicht sind noch leer. Es gibt noch keine Navigation, die Seiten also direkt über die URL aufrufen:

| URL              | Bereich           | Route (`src/app/`)            | Seite (`src/areas/`)               |
| ---------------- | ----------------- | ----------------------------- | ---------------------------------- |
| `/`              | Landingpage       | `(landing)/page.tsx`          | `landing/HomePage.tsx`             |
| `/contact`       | Landingpage       | `(landing)/contact/page.tsx`  | `landing/ContactPage.tsx`          |
| `/business`      | Restaurantansicht | `business/page.tsx`           | `business/DashboardPage.tsx`       |
| `/business/menu` | Restaurantansicht | `business/menu/page.tsx`      | `business/MenuPage.tsx`            |
| `/guest`         | Gastansicht       | `guest/page.tsx`              | `guest/MenuPage.tsx`               |
| `/guest/dish`    | Gastansicht       | `guest/dish/page.tsx`         | `guest/DishDetailPage.tsx`         |
| `/debug`         | Entwicklung       | `debug/page.tsx`              | `debug/DebugPage.tsx` – listet alle Routen automatisch auf |

## Ordnerstruktur

Next.js leitet die URLs aus den Ordnern in `src/app/` ab: Jeder Ordner mit einer `page.tsx` ist eine Seite, eine `layout.tsx` gilt für alle Seiten darunter. Ordner in Klammern wie `(landing)` gruppieren nur und tauchen nicht in der URL auf. Die Dateien in `src/app/` binden nur die eigentlichen Seiten und Layouts aus `src/areas/` ein.

```
src/
├── app/                         # Routen (Next.js App Router)
│   ├── layout.tsx               # Wurzel-Layout: <html>, globale Styles
│   ├── not-found.tsx            # 404-Seite
│   ├── (landing)/               # Landingpage: /, /contact
│   ├── business/                # Restaurantansicht: /business, /business/menu
│   ├── guest/                   # Gastansicht: /guest, /guest/dish
│   └── debug/                   # /debug
│
├── debug/                       # Übersicht aller Routen
│
├── areas/
│   ├── landing/                 # Landingpage
│   │   ├── LandingLayout.tsx    # Header + Footer
│   │   ├── HomePage.tsx
│   │   ├── ContactPage.tsx
│   │   └── components/
│   │       ├── layout/          # Header, Footer
│   │       ├── hero/
│   │       ├── features/
│   │       └── cta/
│   │
│   ├── business/                # Restaurantansicht (Figma-Datei 1)
│   │   ├── BusinessLayout.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MenuPage.tsx
│   │   └── components/
│   │       ├── navigation/
│   │       ├── dashboard/
│   │       └── menu/
│   │
│   └── guest/                   # Gastansicht (Figma-Datei 2)
│       ├── GuestLayout.tsx
│       ├── MenuPage.tsx
│       ├── DishDetailPage.tsx
│       └── components/
│           ├── menu/
│           └── dish-detail/
│
└── shared/                      # von allen Bereichen genutzt
    ├── components/
    │   ├── placeholder/         # Platzhalter für leere Seiten
    │   └── ui/                  # Buttons, Cards … (noch leer)
    └── styles/
        ├── variables.css        # Farben, Schriften, Abstände (aus Figma)
        └── global.css
```

Leere Ordner enthalten eine `.gitkeep`, damit Git sie mit hochlädt. Die Datei löschen, sobald die erste Komponente im Ordner liegt.

Styling läuft über **CSS Modules**: Zu jeder Komponente gehört eine `Name.module.css` im selben Ordner. Farben, Abstände usw. immer über die Variablen aus `variables.css` (z. B. `var(--color-primary)`), nicht fest eintragen.

## Zusammenarbeit (3 Personen)

Jede Person arbeitet in ihrem eigenen Bereich:

| Bereich           | Ordner                                       | Branch     |
| ----------------- | -------------------------------------------- | ---------- |
| Landingpage       | `src/areas/landing/`, `src/app/(landing)/`   | `landing`  |
| Restaurantansicht | `src/areas/business/`, `src/app/business/`   | `business` |
| Gastansicht       | `src/areas/guest/`, `src/app/guest/`         | `guest`    |

Regeln, damit es keine Merge-Konflikte gibt:

1. **Neue Seiten:** Seite in `src/areas/<bereich>/` anlegen und im Routen-Ordner des eigenen Bereichs einen Unterordner mit einer `page.tsx` erstellen, die sie einbindet. `src/app/layout.tsx` bleibt unverändert.
2. **Komponenten** zuerst im eigenen `components/`-Ordner anlegen, in einem passenden Unterordner. Erst wenn ein zweiter Bereich sie braucht, nach `shared/components/` verschieben.
3. **Änderungen in `shared/`** (z. B. `variables.css`) kurz im Team absprechen.
4. Regelmäßig `main` in den eigenen Branch holen und kleine Pull Requests machen.

```bash
git checkout -b guest
```
