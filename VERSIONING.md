# Versioning

Rapvis uses Semantic Versioning.

## Version Format

`MAJOR.MINOR.PATCH`

- `MAJOR`: incompatible changes after `1.0.0`
- `MINOR`: backward-compatible features and meaningful behavior additions
- `PATCH`: backward-compatible fixes, documentation-only corrections, and low-risk internal improvements

## Stability Policy

Rapvis is now at `1.0.0`. From this point:

- breaking behavior changes require a major version bump
- minor releases add features without breaking established behavior
- patch releases stay limited to fixes, low-risk improvements, and documentation updates
- any intentional compatibility impact should still be called out explicitly in the changelog

## Release Checklist

1. Update the version in [package.json](C:/Users/marcusj/Documents/GitHub/rapvis/web/package.json).
2. Add a release entry to [CHANGELOG.md](C:/Users/marcusj/Documents/GitHub/rapvis/CHANGELOG.md).
3. Run `npm run lint`, `npm run test`, and `npm run build` in `web/`.
4. Tag the release as `vX.Y.Z`.

## Source of Truth

`web/package.json` is the canonical source for the application version. The UI version label is injected during the Vite build so the displayed version matches the release metadata automatically.
