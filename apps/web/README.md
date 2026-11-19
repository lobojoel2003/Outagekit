# Outagekit app

The Outagekit web app (React + Vite, installable and offline) and its Android
wrapper (Capacitor). Licensed under the GNU GPL v3; see the
[repository README](../../README.md) for the overview.

## Scripts

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`             | Development server on http://localhost:5173                             |
| `pnpm build`           | Type-check and build the offline web app into `dist/`                   |
| `pnpm preview`         | Serve the built app on http://localhost:4173                            |
| `pnpm test`            | Unit and component tests (Vitest + Testing Library)                     |
| `pnpm e2e`             | Playwright tests on desktop and mobile, including offline (build first) |
| `pnpm icons`           | Re-render the web and Android icons from the logo                       |
| `pnpm screenshots`     | Re-take the README screenshots (needs `pnpm preview` running)           |
| `pnpm android:debug`   | Build the Android debug APK (needs the Android SDK and JDK 21)          |
| `pnpm android:release` | Build a signed release APK and App Bundle (see docs/RELEASING.md)       |

## Environment variables at build time

| Variable       | Default                      | Use                                                                                        |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `BASE_PATH`    | `/`                          | URL path the app is served from, e.g. `/Outagekit/` on GitHub Pages or `./` for any folder |
| `BUILD_NUMBER` | `GITHUB_RUN_NUMBER` or `dev` | Shown in About                                                                             |
| `APP_VERSION`  | `package.json` version       | Overrides the version shown in About and used by Android                                   |

## Code map

| Path                                  | What                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/compute.ts`                  | Turns the saved state into a runtime estimate with `@outagekit/runtime` |
| `src/lib/plan.ts`                     | The ordered plan shown on screen and on the card                        |
| `src/lib/card.ts`, `src/lib/pdf.ts`   | Fridge card content and the one-page PDF (pdf-lib)                      |
| `src/lib/notify.ts`, `src/lib/ics.ts` | Reminders: Android notifications, browser notifications, calendar file  |
| `src/state`                           | App state, reducer (including the outage countdown) and local storage   |
| `src/components/Dial.tsx`             | The 24-hour runtime dial                                                |
| `android/`                            | Capacitor Android project                                               |
