# Rapvis

Rapvis is now a Progressive Web App for demand analysis. It runs entirely in the browser, imports local CSV files, compares current demand against historical demand, and can be installed from the browser as an app.

## Structure

- `web/`: the PWA source built with React, TypeScript, Vite, and `vite-plugin-pwa`
- `Rapvis/`: the previous Python desktop application kept as legacy backup material

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

The output is written to `web/dist/`.

## GitHub Actions

This repository includes:

- `.github/workflows/ci.yml`: installs dependencies, lints, and builds the PWA
- `.github/workflows/deploy-pages.yml`: builds and deploys the PWA to GitHub Pages on pushes to `main`

For Pages deployment, set the repository Pages source to `GitHub Actions` in GitHub settings if it is not already configured.
