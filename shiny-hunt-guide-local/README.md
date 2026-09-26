# Shiny Hunt Guide — local development copy

This ZIP contains the complete source of the currently hosted static app, including its views, styling, artwork toggle, shiny tracking, tracked-hunt persistence, raid and egg filters, event calendar, local-time countdowns, Pokémon details, evolution-family view, service worker, manifest, and exported project icons.

## Requirements

- Node.js 18 or newer
- npm
- An internet connection for the live Pokémon GO feeds and externally hosted Pokémon artwork

## Run locally

Open this folder in VS Code, then run:

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:5173`.

## Production-style local build

```bash
npm run build
npm run preview
```

The generated local build is written to `local-build/`.

## Project structure

- `dist/index.html` — complete page/views and dialogs
- `dist/app.js` — application state, data loading, filters, sorting, shiny artwork, tracking, countdowns, Pokémon details, evolution families, local storage, and calendar export
- `dist/styles.css` — core layout and card styling
- `dist/controls.css` — controls and raid-detail styling
- `dist/dashboard.css` — hunt dashboard, event details, responsive layout, evolution family, and Shadow aura styling
- `dist/odds.css` — shiny-odds and encounter styling
- `dist/icon-192.png`, `dist/icon-512.png`, `dist/icon.svg` — app icons
- `dist/manifest.webmanifest` — installable web-app metadata
- `dist/sw.js` — offline shell/service-worker logic
- `.openai/hosting.json` — configuration used by the hosted Sites version

## Browser storage

The active tracked hunt is stored locally in the browser under `tracked-hunt-v1`. No Pokémon GO account connection or server database is used. Clearing browser site data clears the saved hunt.

## Data and assets that are not embedded

The hosted app loads changing data directly from third-party public feeds at runtime. Those remote databases and images are not part of the app's source repository and therefore are not copied into this ZIP:

- ScrapedDuck/Leek Duck feeds for raids, eggs, research, events, and related Pokémon images
- PoGo API evolution requirements
- PokéAPI Pokémon forms, types, species information, and some normal/shiny artwork
- Leek Duck CDN Pokémon artwork
- PokeMiners model assets referenced by feed URLs
- Live availability inside Campfire, Poké Genie, and PokeRaid

All URLs and the complete fetching/fallback logic are preserved in `dist/app.js`, exactly as used by the current app. The exported Mew app icons are included. No unavailable remote data or artwork has been replaced with generated content.

Because the data feeds are live, the Pokémon, raid, egg, and event listings may change when you refresh the local app. The service worker caches the application shell, but it does not turn all third-party feeds and images into a fully offline database.

## Notes

This is a plain JavaScript static web app. There is no component framework, backend, package-specific source directory, or hidden server-side application code. The complete working application source is in `dist/`.
