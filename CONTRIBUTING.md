# Contributing

## Development Setup

```bash
cd web
npm install
npm run dev
```

## Required Checks

Before opening a pull request or publishing a release, run:

```bash
cd web
npm run lint
npm run build
```

## Project Expectations

- Keep the app fully client-side unless a backend is explicitly introduced as a project decision.
- Preserve the desktop-style workflow and Swedish UI copy unless a change is intentional and reviewed.
- Prefer focused, maintainable changes over broad rewrites.
- Update documentation when behavior, deployment, or release process changes.

## Pull Requests

- Keep changes scoped to a single concern when practical.
- Include a short summary of user-visible behavior changes.
- Call out any compatibility or migration impacts.
- Update [CHANGELOG.md](C:/Users/marcusj/Documents/GitHub/rapvis/CHANGELOG.md) for release-worthy changes.

## Releases

Release guidance is documented in [VERSIONING.md](C:/Users/marcusj/Documents/GitHub/rapvis/VERSIONING.md).
