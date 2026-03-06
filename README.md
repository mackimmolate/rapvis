# Rapvis

Rapvis is a Progressive Web App for demand analysis. It runs entirely in the browser, imports local CSV files, compares current demand against historical demand, and can be installed as a PWA.

## Project Layout

- `web/`: the application source, build config, and static assets
- `.github/workflows/`: CI and GitHub Pages deployment

## Local Development

```bash
cd web
npm install
npm run dev
```

## Production Build

```bash
cd web
npm run build
```

The production output is written to `web/dist/`.

## Deployment

GitHub Actions is configured to:

- lint and build the app on pushes and pull requests
- deploy `web/dist` to GitHub Pages on pushes to `main`

Make sure GitHub Pages is set to use `GitHub Actions` as its source in the repository settings.
