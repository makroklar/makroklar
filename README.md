# makroklar

Klickbarer Prototyp für eine Nährwert-Speisekarte: Restaurants pflegen ihre Gerichte, Gäste sehen per QR-Code Kohlenhydrate (KE/BE), Makros und Allergene – vor allem für Menschen mit Diabetes, aber auch für Fitness & bewusste Ernährung.

> **Stand:** Grundgerüst mit leeren Platzhalterseiten. Kein Backend, keine echte Datenbank, keine Kassenanbindung.

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

Danach im Browser **http://localhost:5173** öffnen. Änderungen am Code werden sofort im Browser aktualisiert.

### Weitere Befehle

| Befehl            | Was passiert                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Entwicklungsserver starten                        |
| `npm run build`   | TypeScript prüfen und fertige Version in `dist/` bauen |
| `npm run preview` | Gebaute Version aus `dist/` lokal ansehen         |

## Seiten im Prototyp

Alle Seiten sind aktuell Platzhalter. Jeder Bereich hat sein eigenes Layout: Die Landingpage hat Header und Footer als pinke Platzhalter-Blöcke, die Layouts von Restaurant- und Gastansicht sind noch leer. Es gibt noch keine Navigation, die Seiten also direkt über die URL aufrufen:

| URL              | Bereich           | Datei                                  |
| ---------------- | ----------------- | -------------------------------------- |
| `/`              | Landingpage       | `areas/landing/HomePage.tsx`           |
| `/contact`       | Landingpage       | `areas/landing/ContactPage.tsx`        |
| `/business`      | Restaurantansicht | `areas/business/DashboardPage.tsx`     |
| `/business/menu` | Restaurantansicht | `areas/business/MenuPage.tsx`          |
| `/guest`         | Gastansicht       | `areas/guest/MenuPage.tsx`             |
| `/guest/dish`    | Gastansicht       | `areas/guest/DishDetailPage.tsx`       |
| `/debug`         | Entwicklung       | `debug/DebugPage.tsx` – listet alle Routen automatisch auf |

## Ordnerstruktur

```
src/
├── main.tsx                     # Einstiegspunkt
├── App.tsx                      # Router – bindet die routes.tsx der 3 Bereiche ein
├── debug/                       # /debug – Übersicht aller Routen
│
├── areas/
│   ├── landing/                 # Landingpage
│   │   ├── routes.tsx
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
│   │   ├── routes.tsx
│   │   ├── BusinessLayout.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MenuPage.tsx
│   │   └── components/
│   │       ├── navigation/
│   │       ├── dashboard/
│   │       └── menu/
│   │
│   └── guest/                   # Gastansicht (Figma-Datei 2)
│       ├── routes.tsx
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

| Bereich           | Ordner                | Branch     |
| ----------------- | --------------------- | ---------- |
| Landingpage       | `src/areas/landing/`  | `landing`  |
| Restaurantansicht | `src/areas/business/` | `business` |
| Gastansicht       | `src/areas/guest/`    | `guest`    |

Regeln, damit es keine Merge-Konflikte gibt:

1. **Neue Seiten** nur in der `routes.tsx` des eigenen Bereichs eintragen – `App.tsx` bleibt unverändert.
2. **Komponenten** zuerst im eigenen `components/`-Ordner anlegen, in einem passenden Unterordner. Erst wenn ein zweiter Bereich sie braucht, nach `shared/components/` verschieben.
3. **Änderungen in `shared/`** (z. B. `variables.css`) kurz im Team absprechen.
4. Regelmäßig `main` in den eigenen Branch holen und kleine Pull Requests machen.

```bash
git checkout -b guest
```
