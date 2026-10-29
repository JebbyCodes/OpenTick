# Releasing OpenTick

```sh
npm run bump -- 0.6.0        # sets the version in every file, adds the CHANGELOG section, README "What's new" and F-Droid notes
$EDITOR CHANGELOG.md         # write what is new (the release refuses to publish while it says TODO)
npm test                     # optional: CI runs it again
git commit -am "Release 0.6.0"
git tag v0.6.0
git push origin main v0.6.0  # or: git push origin v0.6.0
```

Pushing the tag is all it takes. The **Release** workflow checks the tag matches `package.json` and the CHANGELOG, runs the tests, builds
everything in parallel, makes **one** GitHub Release containing every file (with `SHA256SUMS.txt`, build attestations and a description that starts with
*what's new*), then publishes to the stores. A tag with a dash (`v0.6.0-beta.1`) makes a pre-release and skips the stores and Docker's `latest` tag.

`npm run version:sync` re-writes every versioned file from `package.json` (use it after editing `package.json` by hand); `npm run version:check`
fails if anything disagrees. Files covered: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `Cargo.lock`,
`snap/snapcraft.yaml`, `packaging/msix/Package.appxmanifest`, `docs/fdroid/*.yml`, README, CHANGELOG and `fastlane/.../changelogs/<versionCode>.txt`.

## The workflows

| File | What it does | Runs on |
|---|---|---|
| `ci.yml` | unit tests, version check, workflow lint, browser tests, `cargo check --locked` | pull requests, pushes to `main`, and from Release |
| `release.yml` | the orchestrator described above | `git push origin <tag>`, or by hand (a dry run unless "publish" is ticked) |
| `build-desktop.yml` | Windows x64 / x86 / ARM64 (installer, MSI, portable, MSIX), Linux x64 / ARM64 (AppImage, deb, rpm), macOS universal | called by Release |
| `build-android.yml` | signed universal APK, per-CPU APKs, App Bundle, e-ink APK | called by Release |
| `build-ios.yml` | `.ipa` (skipped without Apple secrets) | called by Release |
| `build-snap.yml` | wraps the Linux `.deb` into a Snap (amd64, arm64) | called by Release |
| `build-web.yml` | normal and e-ink website zips | called by Release |
| `build-docker.yml` | multi-arch image to GHCR (and Docker Hub) | called by Release; by hand to test |
| `publish-snap-store.yml` · `publish-microsoft-store.yml` · `publish-chocolatey.yml` · `publish-scoop.yml` · `publish-winget.yml` | upload the files in a GitHub Release to each store. Each skips with a warning when its secret is missing | called by Release; **by hand to retry one** (Actions → the workflow → Run workflow → tag) |
| `deploy-pages.yml` | website (and `/eink/`) on GitHub Pages | pushes to `main` |

Releases made with the built-in `GITHUB_TOKEN` do not send a `release` event, which is why the publishers are *called* by Release instead of waiting for one.
Required files missing from a release fail it; optional ones (32-bit, ARM, x86 phones, iOS) show as warnings.

## Secrets and variables

Add under Settings → Secrets and variables → Actions. Nothing is ever committed; the Android keystore is decoded on the runner only.

| Name | Needed for | Notes |
|---|---|---|
| `ANDROID_KEY_BASE64`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` | Android (**required**) | `base64 -w0 release.jks`; the key password must equal the keystore password |
| `SNAPCRAFT_STORE_CREDENTIALS` | Snap Store | `snapcraft export-login --snaps opentick --channels edge,beta,candidate,stable --acls package_access,package_push,package_release -` |
| `AZURE_AD_TENANT_ID`, `AZURE_AD_APPLICATION_CLIENT_ID`, `AZURE_AD_APPLICATION_SECRET`, `SELLER_ID` | Microsoft Store | Partner Center → Account settings → Microsoft Entra / API access |
| variable `MS_STORE_APP_ID` | Microsoft Store | the app's **Store ID** (`9P…`, Product identity). Defaults to `9PDNNTK8TZ39` |
| `CHOCOLATEY_API_KEY` | Chocolatey | from your chocolatey.org account |
| `OPENTICK_SCOOP_TOKEN` | Scoop | can open pull requests on `JebbyCodes/OpenTick-Scoop` |
| `WINGET_TOKEN` + variable `WINGET_IDENTIFIER` | Winget (optional) | the package must already exist in microsoft/winget-pkgs; `public_repo` token from an account with a fork |
| `IOS_CERTIFICATE`, `IOS_CERTIFICATE_PASSWORD`, `IOS_MOBILE_PROVISION`, `APPLE_DEVELOPMENT_TEAM` | iOS `.ipa` (optional) | base64 `.p12` and `.mobileprovision`; see [Tauri's iOS signing guide](https://v2.tauri.app/distribute/sign/ios/) |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | macOS signing and notarisation (optional) | without them the `.dmg` is unsigned |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | also push to Docker Hub (optional) | GHCR needs nothing extra |

Also enable Settings → Actions → General → Workflow permissions → "Read and write", and make the GHCR package public after the first push if you want anonymous `docker pull`.

## Microsoft Store: how it works now

The Store listing is an **MSIX** app (Store ID `9P…`). The Windows build makes an unsigned `.msix` per CPU, Release bundles them into
`OpenTick_x.y.z.msixbundle`, and `publish-microsoft-store.yml` zips that into an `.msixupload` and submits it with `msstore publish`.
The old workflow tried to change a download URL on an unpackaged (EXE/MSI) listing, which does not exist for this app. The first submission of
each version still goes through Microsoft's certification (a few days). Use "draft" when running by hand to upload without submitting.

## Snap Store: what failed and why

`snapcraft pack` runs under `sudo`, so the `.snap` it writes is owned by root; the old `chmod a+r` then ran as the normal user and was refused
(*Operation not permitted*). `build-snap.yml` now `chown`s the file back before anything else touches it, and builds from the `.deb` the desktop build
already made, so there is no second 30-minute Rust build. Publishing happens in `publish-snap-store.yml` from the files attached to the release.

## What is deliberately not built

- **32-bit Linux:** Tauri 2's web view (WebKitGTK 4.1) has no supported 32-bit Linux build. Use the Docker image (it has 32-bit x86 and ARMv7 variants) or the web app.
- **Windows 7/8, macOS older than 10.15:** not supported by the web views Tauri 2 uses.
- **Flatpak, Homebrew cask, AUR:** possible later; they need their own repositories or manifests.
- **Unsigned iOS:** Tauri cannot produce an installable unsigned `.ipa`; without Apple credentials the iOS job is skipped.
