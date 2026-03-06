# Rapvis

Rapvis is a Progressive Web App for demand analysis. It runs entirely in the browser, imports local CSV files, compares current demand against historical demand, and can be installed like a desktop-style app on supported devices.

## Highlights

- Client-side CSV import with no backend dependency
- Current versus historical demand comparison
- Week, month, and year aggregation
- Interactive chart and sortable article table
- PWA installability, offline shell caching, and GitHub Pages deployment

## Technology

- React 19
- TypeScript
- Vite
- Recharts
- Papa Parse
- `vite-plugin-pwa`

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Local Development

```bash
cd web
npm install
npm run dev
```

The development server starts in the `web/` workspace.

## Quality Checks

```bash
cd web
npm run lint
npm run build
```

The production output is written to `web/dist/`.

## Deployment

GitHub Actions is configured to:

- lint and build the app on pushes and pull requests
- deploy `web/dist` to GitHub Pages on pushes to `main`

Make sure GitHub Pages is configured to publish from `GitHub Actions` in the repository settings.

## Project Layout

- `web/`: application source, build config, and static assets
- `docs/`: architecture and supporting project documentation
- `.github/workflows/`: CI and GitHub Pages deployment workflows

## Documentation

- [Architecture](C:/Users/marcusj/Documents/GitHub/rapvis/docs/ARCHITECTURE.md)
- [Contributing](C:/Users/marcusj/Documents/GitHub/rapvis/CONTRIBUTING.md)
- [Versioning](C:/Users/marcusj/Documents/GitHub/rapvis/VERSIONING.md)
- [Changelog](C:/Users/marcusj/Documents/GitHub/rapvis/CHANGELOG.md)

## Versioning

Rapvis follows Semantic Versioning. The current application version is defined in [package.json](C:/Users/marcusj/Documents/GitHub/rapvis/web/package.json) and injected into the UI at build time so the visible app version and release metadata stay aligned.

## License

Rapvis is released under the MIT License. See [LICENSE](C:/Users/marcusj/Documents/GitHub/rapvis/LICENSE).
