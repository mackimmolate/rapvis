# Security Policy

## Scope

Rapvis is a static, client-side PWA. The main security concerns for this project are:

- supply-chain risk in the frontend and build dependencies
- correctness and resilience when parsing local CSV input
- safe deployment of the static site and GitHub Actions workflows

## Reporting

If you discover a security issue, please report it privately through the repository hosting platform rather than opening a public issue first.

## Supported Security Practices

- Dependencies should be kept current through normal maintenance and periodic review.
- Production CI should pass lint, tests, and build before release.
- User data should remain local to the browser unless the project explicitly adopts a backend in the future.
- Security-relevant dependency exceptions or accepted risks should be documented in pull requests or release notes.

## Current Notes

- The project is desktop-first and optimized for mouse and keyboard interaction.
- Build-time dependencies are monitored separately from runtime dependencies because some advisories can affect only the local or CI build toolchain.
