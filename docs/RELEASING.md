# Releasing Outagekit

One version number covers the web app, the Android app and the
`@outagekit/runtime` library. Versions follow [semver](https://semver.org/).

## Version and build numbers

| Where                  | Value                               | Example                      |
| ---------------------- | ----------------------------------- | ---------------------------- |
| Git tag                | `v` + version                       | `v1.2.0`                     |
| `package.json` (all 3) | version                             | `1.2.0`                      |
| Android `versionName`  | version                             | `1.2.0`                      |
| Android `versionCode`  | major × 10000 + minor × 100 + patch | `10200`                      |
| Build number           | GitHub Actions run number           | `57`                         |
| Shown in the app       | About → Version                     | `1.2.0 (build 57 · 3f2a1bc)` |

## Steps

1. Make sure `main` is green.
2. Move the notes under **Unreleased** in `CHANGELOG.md` into place and set the
   version everywhere:

   ```bash
   pnpm version:set 1.2.0
   ```

3. Commit, tag and push:

   ```bash
   git commit -am "Release v1.2.0"
   git tag -a v1.2.0 -m "Outagekit v1.2.0"
   git push origin main --follow-tags
   ```

4. The **Release** workflow checks the tag matches the packages, runs the
   tests, builds everything and publishes a GitHub release with:
   - the Android APK (and App Bundle when signing is configured),
   - a self-hostable web app zip,
   - the `@outagekit/runtime` tarball,
   - the device and power source catalogs as JSON,
   - SHA-256 checksums,
   - notes taken from `CHANGELOG.md`.

   Tags with a suffix such as `v1.3.0-beta.1` are published as pre-releases.

5. Pushing to `main` also redeploys the web app to GitHub Pages.

## Signing the Android app

Without a signing key the release includes a **debug-signed** APK, which
installs fine for testing but cannot be updated in place by a signed build.
To publish properly signed builds, create a key once and keep it safe; losing
it means users must uninstall to update.

```bash
keytool -genkeypair -v -keystore outagekit-release.jks -alias outagekit \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 outagekit-release.jks > keystore.b64
```

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret                      | Value                      |
| --------------------------- | -------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | contents of `keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password      |
| `ANDROID_KEY_ALIAS`         | `outagekit`                |
| `ANDROID_KEY_PASSWORD`      | the key password           |

## Publishing the library to npm

Add an `NPM_TOKEN` secret (an npm automation token). Stable releases are then
published as `@outagekit/runtime` with provenance. Without the secret the
step is skipped and the tarball is still attached to the GitHub release.

## Re-running a release

Run the **Release** workflow manually from the Actions tab and enter an
existing tag; it rebuilds and updates that release.
