# Changelog

All notable changes to this project will be documented in this file.

This project follows Semantic Versioning. See [VERSIONING.md](C:/Users/marcusj/Documents/GitHub/rapvis/VERSIONING.md).

## [Unreleased]

## [1.0.0] - 2026-03-06

### Added

- Core automated tests for demand parsing, aggregation, and app smoke behavior
- Security and dependency maintenance documentation
- Dependabot configuration for npm and GitHub Actions updates
- Progressive Web App implementation for Rapvis using React, TypeScript, and Vite
- Client-side CSV parsing, aggregation, comparison, and persistence
- GitHub Actions workflows for CI and GitHub Pages deployment
- PWA install and offline support

### Changed

- `vite-plugin-pwa` moved to development dependencies
- CI now runs tests in addition to lint and build checks
- The repository is documented as desktop-first
- Browser UI aligned closely with the original desktop workflow and layout
- Visible app version is now sourced from `web/package.json` at build time
- The project is now released as `1.0.0`

### Removed

- Legacy Python desktop application and packaging artifacts from the active project tree
