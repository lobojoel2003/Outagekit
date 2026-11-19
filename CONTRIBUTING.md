# Contributing to Outagekit

Thank you for helping families stay safe through power cuts. Outagekit is used
in emergencies, so correctness and clarity matter more than features.

## Ways to help

- **Correct or add a device figure.** Open a
  [catalog correction](https://github.com/lobojoel2003/Outagekit/issues/new?template=catalog.yml)
  with a link to the manufacturer's manual or specification sheet and the page
  or section. Retailer or battery-seller pages are not enough on their own.
- **Report a bug** with the steps, what you expected and what happened.
- **Improve wording.** The plan and card are read by stressed people: short,
  plain sentences win.
- **Code.** Fix bugs, improve accessibility, add tests.

## Development

You need Node.js 22.12 or newer and pnpm 10 (`corepack enable` sets it up).

```bash
pnpm install
pnpm dev           # web app at http://localhost:5173
pnpm test          # unit tests for the library and the app
pnpm e2e           # Playwright end-to-end tests (build first: pnpm build)
pnpm check         # lint, formatting, types and tests, as CI runs them
```

### Repository layout

| Path                           | What it is                                         | License |
| ------------------------------ | -------------------------------------------------- | ------- |
| `packages/runtime`             | `@outagekit/runtime`: runtime math and the catalog | MIT     |
| `packages/runtime/src/catalog` | The open JSON device and power source catalog      | MIT     |
| `apps/web`                     | The React app (PWA) and its Android wrapper        | GPL-3.0 |
| `apps/web/android`             | Capacitor Android project                          | GPL-3.0 |
| `docs`                         | Method, catalog listing, release guide             |         |
| `scripts`                      | Versioning, release notes, catalog docs            |         |

### Editing the catalog

1. Edit `packages/runtime/src/catalog/devices.json` or `power-sources.json`.
   The JSON schemas in `packages/runtime/schema` describe every field.
2. Set `"verified": true` only with a source URL to a manufacturer document
   you have read.
3. Run `pnpm catalog:docs` to regenerate `docs/catalog.md`, then `pnpm test`.

### Android

Install Android Studio (or the Android SDK and JDK 21), then:

```bash
pnpm --filter @outagekit/web android:debug
```

The APK lands in `apps/web/android/app/build/outputs/apk/debug/`.

## Pull requests

- Keep each pull request to one change, with tests for behaviour changes.
- `pnpm check` must pass.
- Add a line under **Unreleased** in `CHANGELOG.md` for anything users notice.
- By contributing you agree your work is licensed under the license of the
  part of the repository you change (MIT for `packages/runtime`, GPL-3.0 for
  everything else).
