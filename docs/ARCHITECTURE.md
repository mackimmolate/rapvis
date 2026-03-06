# Architecture

## Overview

Rapvis is a static Progressive Web App deployed to GitHub Pages. There is no backend and no server-side persistence. Demand CSV files are loaded locally in the browser, transformed client-side, and used to drive the chart and comparison table.

The product is desktop-first. Interaction design assumes mouse and keyboard availability, including multi-select and context-menu actions in the article table.

## Main Application Structure

- [App.tsx](C:/Users/marcusj/Documents/GitHub/rapvis/web/src/App.tsx): top-level UI composition, interaction state, filtering, selection, and PWA install/update controls
- [demand.ts](C:/Users/marcusj/Documents/GitHub/rapvis/web/src/lib/demand.ts): CSV parsing, normalization, aggregation, filtering, and table/chart data shaping
- [storage.ts](C:/Users/marcusj/Documents/GitHub/rapvis/web/src/lib/storage.ts): persistence of user preferences in `localStorage`
- [PeriodChart.tsx](C:/Users/marcusj/Documents/GitHub/rapvis/web/src/components/PeriodChart.tsx): chart rendering and period selection interaction

## Data Flow

1. The user imports a current-demand CSV and optionally a historical CSV.
2. The app parses and normalizes the records in the browser.
3. Filters for article group, period range, and time scale are applied in memory.
4. Aggregated series feed the chart and summary text.
5. Period selection and article selection drive the comparison table.

## Persistence

- UI preferences are stored locally in the browser.
- CSV data is not uploaded anywhere by the app.
- PWA assets are cached for app-shell availability offline.

## Deployment Model

- CI is defined in [ci.yml](C:/Users/marcusj/Documents/GitHub/rapvis/.github/workflows/ci.yml).
- GitHub Pages deployment is defined in [deploy-pages.yml](C:/Users/marcusj/Documents/GitHub/rapvis/.github/workflows/deploy-pages.yml).
- The Vite base path is computed from the GitHub repository name so the same build works correctly on GitHub Pages.

## Quality Gates

- ESLint enforces source quality.
- Vitest covers core parsing and aggregation logic plus application smoke behavior.
- Production builds are validated in CI before deployment.
