# Security Policy

## Supported version

Security fixes are applied to the current release line.

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| Earlier development snapshots | No |

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository when available.
Do not publish authentication tokens, account exports, personal tracker data,
or working exploit details in a public issue.

Include:

- A concise description and affected component
- Reproduction prerequisites and steps
- Potential account or data impact
- Suggested remediation when known

Reports should receive an initial acknowledgement within seven days. A fix and
disclosure timeline depends on severity, exploitability, and coordination with
Clerk, Convex, or another affected provider.

## Security boundaries

- Clerk authenticates users.
- Convex functions derive account ownership from the authenticated identity.
- IndexedDB is trusted only as an account-scoped offline cache and outbox.
- Browser `VITE_*` configuration is public and must never contain secrets.
- Migration activation requires verified counts and checksums.

Dependency audit findings are reviewed during release preparation. Automated
major-version remediation is not applied without compatibility testing.
