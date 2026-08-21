# Security Policy

## Clipboard data

Clipboard contents must never be logged, stored in Netlify, committed to Git, or displayed in the dashboard. The native agents enforce a maximum payload size and block common sensitive patterns before syncing.

## Pairing

Pairing sessions are short-lived, single-use, and require explicit approval. Permanent shared secrets are generated server-side for a pairing result and stored only on the paired local devices.

## Reporting vulnerabilities

For the public beta, report security issues privately to the project maintainer before opening public issues.
