# Contributing

LocalBridge treats clipboard data as sensitive. Contributions should preserve these rules:

- Do not log clipboard contents.
- Do not add cloud clipboard history.
- Do not expose permanent secrets to frontend JavaScript.
- Keep native clipboard access in the agents.
- Add or update tests for protocol, pairing, authentication, and filtering changes.

Run `npm test` before opening a pull request.
