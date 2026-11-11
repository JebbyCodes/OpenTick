# Releasing OpenTick

**Contents:** [Quick start](#quick-start) · [What a release run does](#what-a-release-run-does) · [The workflows](#the-workflows) · [Release notes](#release-notes) · [What CI checks](#what-ci-checks) · [Secrets and variables](#secrets-and-variables) · [Platform notes](#platform-notes) · [Troubleshooting](#troubleshooting) · [Removed workflows and what is not built](#removed-workflows-and-what-is-not-built)

## Quick start

There are two ways to start. Both end the same way: a tag, which starts the **Release** workflow.

**A. On your computer**

```sh
npm run bump -- 0.6.0        # sets the version in every file, adds the CHANGELOG section, the README's "What's new" and the F-Droid notes
$EDITOR CHANGELOG.md         # write what is new (the release refuses to publish while it says TODO)
npm run version:sync         # copies that section into the README (only the latest release is kept there; older ones stay in CHANGELOG.md)
npm test                     # optional: CI runs it again
git commit -am "Release 0.6.0"
git tag v0.6.0
git push origin main v0.6.0  # or: git push origin v0.6.0
```

**B. From the Actions tab (no terminal)**

1. Actions → **Prepare release** → Run workflow → type the version (for example `0.6.0`). Tick *Dry run* first if you want to see what would change.
2. It runs the same `npm run bump`, checks every file agrees, pushes a branch `release/v0.6.0` and opens a pull request with a checklist. It also starts CI on the branch.
3. On that branch: write the CHANGELOG section, run `npm run version:sync` (or edit the README's *What's new* to match), and wait for CI.
4. Optional but recommended: Actions → **Release** → Run workflow → choose the `release/v0.6.0` branch, leave *publish* off. That is a full dry run of the real thing.
5. Merge the pull request, then tag the merge: `git switch main && git pull && git tag v0.6.0 && git push origin v0.6.0`.

Prepare release needs one setting, once: Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests**.
Without it the branch is still pushed and the run's summary gives the link to open the pull request by hand. It never tags and never publishes: only a person pushes the tag.

`npm run version:sync` re-writes every versioned file from `package.json` (use it after editing `package.json` by hand); `npm run version:check`
fails if anything disagrees. Files covered: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `Cargo.lock`,
`snap/snapcraft.yaml`, `packaging/msix/Package.appxmanifest`, `docs/fdroid/*.yml`, README, CHANGELOG and `fastlane/.../changelogs/<versionCode>.txt`.

## What a release run does

Pushing the tag is all it takes. The **Release** workflow works in six stages:

| # | Stage | What happens |
|---|---|---|
| 1 | **prepare** | The tag must match `package.json`, every other versioned file must agree, and `CHANGELOG.md` must have a finished section for it. Fails fast, before anything is built. |
| 2 | **tests** | The CI workflow (unit tests, pack library check, browser tests, Rust check). It runs *while* the builds run to save time, but step 4 refuses to make a release unless it passed. |
| 3 | **build** | Desktop, Android, web, Docker, iOS and the smartwatch packages run side by side; Snap and the MSIX bundle wrap the desktop builds. |
| 4 | **release** | **One** GitHub Release containing every file, `SHA256SUMS.txt`, signed build attestations, a description that starts with *what's new* and has a downloads table, and GitHub's own *What's Changed* list underneath. |
| 5 | **publish** | Only after the release exists, each on its own: Docker registry, Snap Store, Microsoft Store, Chocolatey, Scoop, Winget. A missing secret makes a publisher skip itself with a warning. |
| 6 | **summary** | Always runs, even after a failure. A table at the top of the run page: every stage, its result, and whether it was required or optional. Start reading there. |

Required: desktop, Android, web, Docker, Snap, the MSIX bundle and the tests. Optional (the release is still made if they fail or are skipped): iOS, the smartwatch packages and every publisher.

**Dry run:** Actions → Release → Run workflow, leave "publish" off. Everything is built and tested, nothing is released or pushed, and the files stay in the run's artifacts.

**Pre-releases:** a tag with a dash (`v0.6.0-beta.1`) makes a GitHub pre-release. It goes to the Snap Store `beta` channel, gets only its own Docker tag (never `latest`), and is not sent to the Microsoft Store, Chocolatey, Scoop or Winget.

## The workflows

Seventeen files in `.github/workflows/`, grouped by the first word of their name. Everything starts from `ci.yml`, `release.yml`, `prepare-release.yml` or `deploy-pages.yml`;
the `build-*` and `publish-*` files are building blocks that Release calls (each can also be run by hand to try one piece or retry a failed one).

| File | What it does | Runs on |
|---|---|---|
| `prepare-release.yml` | bumps the version everywhere, pushes `release/vX.Y.Z` and opens a pull request with a checklist. Never tags, never publishes | by hand (Actions → Prepare release) |
| `ci.yml` | unit tests, version check, workflow lint, pack library check, browser tests, `cargo check --locked` | pull requests, pushes to `main`, and as Release's test gate |
| `release.yml` | the orchestrator described above. **The only workflow that starts from a tag** | `git push origin <tag>`, or by hand (a dry run unless "publish" is ticked) |
| `build-desktop.yml` | Windows x64 / x86 / ARM64 (installer, MSI, portable, MSIX), Linux x64 / ARM64 (AppImage, deb, rpm), macOS universal | called by Release |
| `build-android.yml` | signed universal APK, per-CPU APKs, App Bundle, e-ink APK | called by Release |
| `build-ios.yml` | `.ipa` (skipped, not failed, without Apple secrets) | called by Release |
| `build-snap.yml` | wraps the Linux `.deb` into a Snap (amd64, arm64) | called by Release |
| `build-watch.yml` | the smartwatch edition as packages: a signed Wear OS APK and an unsigned Tizen `.wgt`. **Optional**: a failure here never stops a release | called by Release |
| `build-web.yml` | normal, e-ink and smartwatch website zips | called by Release |
| `build-docker.yml` | the Docker image as release files: one `.tar.gz` per CPU (amd64, arm64, armv7, i386) and a compose file. Starts the image and checks it answers. Pushes nothing | called by Release |
| `publish-docker.yml` | pushes the multi-architecture image to `ghcr.io` (and Docker Hub if configured), then checks that anyone can pull it | called by Release, after the GitHub Release exists |
| `publish-snap-store.yml` | uploads every `.snap` in the release to the Snap Store | called by Release |
| `publish-microsoft-store.yml` | submits the `.msixupload` to the Microsoft Store | called by Release (stable only) |
| `publish-chocolatey.yml` | builds the Chocolatey package, attaches it to the release, pushes it | called by Release (stable only) |
| `publish-scoop.yml` | opens a pull request on the Scoop bucket | called by Release (stable only) |
| `publish-winget.yml` | opens a pull request on `microsoft/winget-pkgs` (off until configured) | called by Release (stable only) |
| `deploy-pages.yml` | website (and `/eink/`, `/watch/`, the privacy policy and the `/marketplace/` pack library) on GitHub Pages | pushes to `main` |

Besides the workflows: `.github/release.yml` (the release-notes categories, see below), `.github/dependabot.yml` (daily pull requests for npm, Cargo and GitHub Actions version updates) and the two local actions in `.github/actions/`.
The helper scripts the workflows call live in `scripts/release/` (`bump-version`, `collect-assets`, `release-notes`, `run-summary`), `scripts/ci/lint-workflows.py` and `scripts/packs/validate-packs.mjs`; `test/release.mjs` keeps all of them honest.

Every `publish-*` workflow skips itself with a warning when its secret is missing, and can be re-run by hand: Actions → the workflow → Run workflow → tag.
Releases made with the built-in `GITHUB_TOKEN` do not send a `release` event, which is why the publishers are *called* by Release instead of waiting for one.
Required files missing from a release fail it; optional ones (32-bit, ARM, x86 phones, iOS, 32-bit Docker images, the Wear OS and Tizen packages) show as warnings.

## Release notes

A release description has three parts, top to bottom:

1. **What's new**: the version's section of `CHANGELOG.md`. You write this. The release refuses to publish while it is missing or still says TODO.
2. **Downloads**: a table of the files that really exist (Windows, macOS, Linux, Android, iOS, Smartwatch, Docker, Web) and how to verify them with `SHA256SUMS.txt`.
3. **What's Changed**: GitHub's own list of merged pull requests since the last release, grouped by `.github/release.yml`.

The groups come from **pull request labels**. A pull request lands in the first group whose label it carries; unlabelled ones fall into *Other changes*. Add a label when merging and it files itself:

| Group | Labels |
|---|---|
| ⚠️ Breaking changes | `breaking` |
| 🔒 Security and privacy | `security`, `privacy` |
| ✨ New features | `feature`, `enhancement` |
| 👥 Contacts | `contacts` |
| 🧩 Custom sections, packs and themes | `sections`, `packs`, `marketplace`, `themes` |
| 🔄 Sync and encryption | `sync`, `encryption` |
| 🐛 Bug fixes | `bug`, `fix` |
| 📱 Platforms and packaging | `platform`, `android`, `ios`, `desktop`, `windows`, `macos`, `linux`, `docker`, `snap`, `web`, `watch`, `packaging` |
| 🚀 Release and CI | `ci`, `release`, `workflow` |
| 📚 Documentation | `documentation`, `docs` |
| 📦 Dependencies | `dependencies` (Dependabot adds it) |

Pull requests labelled `skip-changelog`, `duplicate`, `invalid`, `wontfix` or `question`, and anything by `github-actions`, are left out.

## What CI checks

`ci.yml` runs three independent jobs on every pull request and every push to `main`, and again as the first gate of every release:

1. **Tests and checks:** every file carries the same version (`npm run version:check`), the workflow files are consistent (`python scripts/ci/lint-workflows.py`),
   the pack library is valid (`npm run packs:check`), the unit and regression tests (`npm test`), and the web app builds.
2. **Browser tests:** the built app in headless Chromium (`npm run test:browser`).
3. **Rust check:** `cargo check --locked`, so a stale `Cargo.lock` is an error.

**The pack library** (`marketplace/`) holds the sample section packs and themes, and is published read-only at `/marketplace/` on the website. `npm run packs:check` opens every file
the way the app opens a pack someone gives it, and fails if the app would drop or change anything (a wrong licence, a version that is not `1.2.3`, a field of an unknown type,
a theme colour that is not allowed, a file missing from `index.json`, …). Anyone adding a pack runs it first; [PACKS.md](PACKS.md) has the rules.

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

Also enable Settings → Actions → General → Workflow permissions → "Read and write", and tick "Allow GitHub Actions to create and approve pull requests" if you want *Prepare release* to open its pull request itself.

## Platform notes

### Docker: where to find it

Docker appears in three places, all made by a release:

1. **The GitHub Release** has the image as downloads: `OpenTick_x.y.z_docker-amd64.tar.gz`, `-arm64`, `-armv7` and `-i386`, plus `OpenTick_x.y.z_docker-compose.yml`
   pinned to that version. They are listed in the release's *Docker* section and in `SHA256SUMS.txt`. Load one with `gunzip -c <file> | docker load`.
2. **The container registry**: `ghcr.io/<owner>/opentick:x.y.z` (and `x.y`, and `latest` for stable releases). One tag covers every CPU. It is also on the repository's
   *Packages* sidebar. `publish-docker.yml` pushes it after the GitHub Release exists, so `latest` never moves for a release that did not happen.
3. **Docker Hub**, if you add the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets.

**First release only: make the package public.** GitHub creates a new package as *private*. After the first push open the repository's Packages → `opentick` →
Package settings → Change visibility → Public. Until then only you can `docker pull` it. `publish-docker.yml` tests an anonymous pull at the end of every run
and shows a warning with this exact fix if it fails, so you will not have to guess.

`build-docker.yml` also starts the freshly built amd64 image and checks that `/healthz`, the normal app (with the right version), `/eink/` and `/watch/` all answer, so a
broken image stops the release instead of reaching a server.

### Smartwatch packages

The watch edition (see [WATCHES.md](WATCHES.md)) is the normal app built with `--watch` (or `OPENTICK_WATCH=1`). It ships in five places:

1. `/watch/` on the website, in the Docker image and in `OpenTick_x.y.z_web-watch.zip`: built by `deploy-pages.yml`, `build-docker.yml` and `build-web.yml`. These are **required**.
2. `OpenTick_x.y.z_android-watch-universal.apk`: the Android build with `OPENTICK_WATCH=1`, the Android project marked as a Wear OS app by
   `node scripts/android/android-widgets.mjs --watch` (the `watch: 'true'` input of the `setup-android` action), signed with the same key as the phone APK.
3. `OpenTick_x.y.z_tizen-unsigned.wgt`: `node scripts/watch/make-tizen-wgt.mjs --version x.y.z`. It is **unsigned** on purpose: a Tizen app is signed with the
   installer's own Samsung certificate, and this repository must not hold one.

Items 2 and 3 are made by `build-watch.yml`, which Release treats like iOS: the release waits for it but is made even if it fails (the files then show as
warnings). They cannot be run on a normal computer, so the first release that includes them is also their first real test: check the run, and try the APK on a
watch or the Wear OS emulator (Android Studio → Device Manager → Wear OS) before telling anyone it works.

### Microsoft Store: how it works now

The Store listing is an **MSIX** app (Store ID `9P…`). The Windows build makes an unsigned `.msix` per CPU, Release bundles them into
`OpenTick_x.y.z.msixbundle`, and `publish-microsoft-store.yml` zips that into an `.msixupload` and submits it with `msstore publish`.
The old workflow tried to change a download URL on an unpackaged (EXE/MSI) listing, which does not exist for this app. The first submission of
each version still goes through Microsoft's certification (a few days). Use "draft" when running by hand to upload without submitting.

### Snap Store: what failed and why

`snapcraft pack` runs under `sudo`, so the `.snap` it writes is owned by root; the old `chmod a+r` then ran as the normal user and was refused
(*Operation not permitted*). `build-snap.yml` now `chown`s the file back before anything else touches it, and builds from the `.deb` the desktop build
already made, so there is no second 30-minute Rust build. Publishing happens in `publish-snap-store.yml` from the files attached to the release: it uploads every `.snap` (amd64 and arm64) to the same channel, because the Store keeps one revision per CPU.

## Troubleshooting

Start with the **Summary** job at the bottom of the run: it names the stage that failed and says whether it was required.

| Symptom | Cause and fix |
|---|---|
| The run stops at *Check the tag* with "Tag does not match the code" | The tag and `package.json` disagree. `npm run bump -- X.Y.Z` (or `npm run version:sync`), commit, then move the tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z && git tag vX.Y.Z && git push origin vX.Y.Z`. |
| *Check the tag* says the CHANGELOG is missing or says TODO | Write the `## X.Y.Z` section in `CHANGELOG.md`, run `npm run version:sync`, commit, and move the tag as above. |
| Everything built but there is no GitHub Release | A required stage failed, or tests did (the Summary lists them), or it was a dry run (*publish* was off). Fix it and push the tag again, or run Release by hand with *publish* ticked. |
| A publisher shows a warning and did nothing | Its secret is missing (see the table above). Add it, then run that workflow by hand: Actions → the workflow → Run workflow → tag. |
| One store failed, the others went out | Publishers stand alone. Re-run just that one by hand with the tag. |
| *Prepare release* pushed a branch but opened no pull request | Tick Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests", or open it from the link in the run summary. |
| No CI checks on the release pull request | A pull request opened with the built-in token does not start CI by itself. *Prepare release* starts CI on the branch; if that failed, start it by hand (Actions → CI → Run workflow → the branch). |
| *Prepare release* says the branch or tag exists | A release for that version was already prepared or made. Merge or delete `release/vX.Y.Z`, or pick the next version. |
| `npm run packs:check` fails | The message names the pack and the rule it broke. [PACKS.md](PACKS.md) explains each rule; `npm test` runs the same check. |
| Docker image cannot be pulled by others | The package is still private: Packages → `opentick` → Package settings → Change visibility → Public (first release only). |

## Removed workflows and what is not built

Four older workflows were deleted because they duplicated Release and caused problems: `build.yml` (started from the same `v*` tags and published its
own partial release and a second Microsoft Store submission), `deploy-web.yml` (a second GitHub Pages deploy sharing `deploy-pages.yml`'s concurrency
group, so the two cancelled each other), `update-scoop-bucket.yml` (waited for a "release published" event that never arrives, and used the same pull-request
branch as `publish-scoop.yml`) and `test-snap.yml` (a manual Snap build that duplicated `build-snap.yml`).

Deliberately not built:

- **32-bit Linux:** Tauri 2's web view (WebKitGTK 4.1) has no supported 32-bit Linux build. Use the Docker image (it has 32-bit x86 and ARMv7 variants) or the web app.
- **Windows 7/8, macOS older than 10.15:** not supported by the web views Tauri 2 uses.
- **Flatpak, Homebrew cask, AUR:** possible later; they need their own repositories or manifests.
- **Unsigned iOS:** Tauri cannot produce an installable unsigned `.ipa`; without Apple credentials the iOS job is skipped.
