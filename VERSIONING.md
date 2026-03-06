# Versioning

Rapvis uses Semantic Versioning.

## Version Format

`MAJOR.MINOR.PATCH`

- `MAJOR`: incompatible changes after `1.0.0`
- `MINOR`: backward-compatible features and meaningful behavior additions
- `PATCH`: backward-compatible fixes, documentation-only corrections, and low-risk internal improvements

## Pre-1.0 Guidance

The project is currently below `1.0.0`. Until `1.0.0` is released:

- minor releases may still include breaking changes if they are necessary
- patch releases should remain safe bug-fix or documentation updates
- all breaking behavior changes should still be called out explicitly in the changelog

## Release Checklist

1. Update the version in [package.json](C:/Users/marcusj/Documents/GitHub/rapvis/web/package.json).
2. Add a release entry to [CHANGELOG.md](C:/Users/marcusj/Documents/GitHub/rapvis/CHANGELOG.md).
3. Run `npm run lint`, `npm run test`, and `npm run build` in `web/`.
4. Tag the release as `vX.Y.Z`.

## Source of Truth

`web/package.json` is the canonical source for the application version. The UI version label is injected during the Vite build so the displayed version matches the release metadata automatically.
