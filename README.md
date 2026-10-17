
# OpenTick

<p align="center">
  <img src="src/logo.png" alt="OpenTick" width="90">
</p>

<h3 align="center">OpenTick</h3>

<p align="center">Open-source productivity and project planning.</p>

<p align="center">
  <a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=opentick">
    <img src="https://raw.githubusercontent.com/RookieEnough/Orion-Store/refs/heads/main/assets/orion-badge.png" alt="Get it on Orion Store" height="36">
  </a>
</p>


<p align="center">
  <a href="https://github.com/JebbyCodes/OpenTick/releases">
    <img src="https://img.shields.io/github/v/release/JebbyCodes/OpenTick?display_name=tag&style=flat-square" alt="Latest release">
  </a>
  <a href="https://github.com/JebbyCodes/OpenTick/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Unlicense-blue.svg?style=flat-square" alt="Licence: Unlicense">
  </a>
  <a href="https://github.com/JebbyCodes/OpenTick/issues">
    <img src="https://img.shields.io/github/issues/JebbyCodes/OpenTick?style=flat-square" alt="Open issues">
  </a>
  <a href="https://github.com/JebbyCodes/OpenTick/stargazers">
    <img src="https://img.shields.io/github/stars/JebbyCodes/OpenTick?style=flat-square" alt="GitHub stars">
  </a>
</p>

---

## Contents

- [About](#about)
- [Features](#features)
- [Platforms](#platforms)
- [Installation](#installation)
- [Building from source](#building-from-source)
- [Development](#development)
- [OpenGantt integration](#opengantt-integration)
- [Privacy and security](#privacy-and-security)
- [F-Droid compatibility](#f-droid-compatibility)
- [AI-assisted development](#ai-assisted-development)
- [Contributing](#contributing)
- [Reporting issues](#reporting-issues)
- [Roadmap](#roadmap)
- [Licence](#licence)

## About

**OpenTick** is an open-source productivity application built to bring task management and project planning together in one place.

Developed with modern web technologies and [Tauri 2](https://v2.tauri.app/), OpenTick aims to provide a cross-platform experience with native application packaging.

The project also incorporates [OpenGantt](https://github.com/JebbyCodes/OpenGantt), a separate open-source Gantt chart project, to support visual project planning.

OpenTick is developed in the open. Its source code, issues, releases, and development history are available on GitHub.

- **Source code:** [GitHub repository](https://github.com/JebbyCodes/OpenTick)
- **Downloads:** [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases)
- **Bug reports and suggestions:** [GitHub Issues](https://github.com/JebbyCodes/OpenTick/issues)
- **Licence:** [The Unlicense](LICENSE)

> OpenTick is under active development. Feature completeness, platform support, and distribution availability depend on the current version.

## Features

OpenTick aims to combine everyday productivity with more advanced project-planning capabilities.

### Task management

Organise tasks and keep track of the work that needs to be done.

### Scheduling and time management

Plan activities and structure your time around your commitments.

### Project planning

Organise larger projects and break work into manageable tasks.

### Gantt charts

OpenTick integrates [OpenGantt](https://github.com/JebbyCodes/OpenGantt), providing a foundation for visual project timelines and scheduling.

### Cross-platform application

Built with Tauri 2 and web technologies, OpenTick is designed to support multiple operating systems through a shared application codebase.

### Open-source development

Inspect the source code, report issues, propose improvements, and contribute to development.

*Feature availability may vary by version and platform. Consult the current implementation and release notes for the status of individual features.*

## Platforms

OpenTick's development targets multiple environments.

| Platform | Status |
|---|---|
| Web | See the current build configuration |
| Windows | Desktop build supported by the configured toolchain |
| Linux | Desktop build subject to platform prerequisites |
| macOS | Desktop build subject to platform prerequisites |
| Android | Mobile build subject to Android toolchain configuration |
| iOS | Availability depends on the current implementation and build configuration |

Not every platform necessarily has a published release. Check [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases) for available downloads.

## Installation

### Orion Store

Get OpenTick through its Orion Store listing.

<p align="center">
  <a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=opentick">
    <img src="https://raw.githubusercontent.com/RookieEnough/Orion-Store/refs/heads/main/assets/orion-badge.png" alt="Get it on Orion Store" height="36">
  </a>
</p>

### GitHub Releases

Visit the [Releases page](https://github.com/JebbyCodes/OpenTick/releases) to find published builds.

1. Open the release for your platform.
2. Download the appropriate installation package, if available.
3. Follow the installation instructions for your operating system.

Only install packages from sources you trust.

### Build from source

You can also clone the repository and build OpenTick yourself. See [Building from source](#building-from-source).

## Building from source

### Prerequisites

Install the tools required for your target platform:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- npm
- [Rust and Cargo](https://www.rust-lang.org/tools/install)
- [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)

Android and iOS builds may require additional SDKs, toolchains, and platform-specific configuration.

Use the Node.js version and other toolchain versions specified by the repository's configuration and CI workflows.

### 1. Clone the repository

```bash
git clone https://github.com/JebbyCodes/OpenTick.git
cd OpenTick
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the web application

```bash
npm run build
```

### 4. Build the desktop application

```bash
npm run build:app
```

The output location and available package formats depend on the target platform and Tauri configuration.

For Android, iOS, and other platform-specific builds, consult the project's configuration and the official [Tauri documentation](https://v2.tauri.app/).

## Development

### Available commands

Run commands from the repository root.

| Command | Purpose |
|---|---|
| `npm install` | Install project dependencies |
| `npm run build` | Build the web application |
| `npm run build:app` | Run the configured application build |
| `npm test` | Run the configured test suite |
| `npm run sync:gantt` | Synchronise the integrated OpenGantt code |
| `npm run check:gantt` | Check the OpenGantt integration |

These commands depend on the scripts defined in `package.json`. If a command is unavailable in a particular checkout, inspect that file for the current scripts.

### Testing

Before submitting changes:

1. Install the project dependencies.
2. Run the relevant build.
3. Run the available tests.
4. Test affected platform-specific functionality.
5. Verify that changes to the OpenGantt integration behave as intended.
6. Document any known limitations.

A successful web build does not necessarily demonstrate that every native platform builds or functions correctly.

### OpenGantt integration workflow

OpenTick integrates code from [JebbyCodes/OpenGantt](https://github.com/JebbyCodes/OpenGantt).

The integration includes synchronisation and verification scripts. Use the repository's established workflow when updating the embedded project so that changes are not unintentionally overwritten by later synchronisation.

Refer to the upstream repository for its own documentation, licence, and release history.

## Privacy and security

OpenTick's public source code allows its implementation to be inspected. However, open-source availability alone does not guarantee privacy or security.

Before storing sensitive information, review the implementation to establish:

- Where application data is stored.
- Whether information is transmitted to external services.
- Which permissions are requested on each platform.
- How backups, exports, and synchronisation operate, where implemented.
- How updates and downloaded application packages are distributed.

Do not assume that every platform has identical privacy characteristics or that all data remains on-device without verifying the implementation.

### Security reports

If you discover a security vulnerability, avoid publicly disclosing sensitive exploit details before the issue can be assessed. Use an appropriate repository contact or reporting channel for responsible disclosure.

## F-Droid compatibility

OpenTick may be a candidate for inclusion in [F-Droid](https://f-droid.org/), subject to its licensing, dependency, build, and quality requirements.

**OpenTick is not represented here as an accepted or published F-Droid application.** Inclusion requires a separate review and approval process.

### AI-generated code and F-Droid

OpenTick has been developed with assistance from generative AI tools. AI assistance alone does not establish whether an application meets F-Droid's requirements.

The relevant considerations include:

- Whether the submitted code can be legally distributed under compatible free-software licences.
- Whether the developer has appropriately reviewed and tested the code.
- Whether dependencies, build tools, and bundled assets meet the applicable requirements.
- Whether the application can be built from source in F-Droid's build environment.
- Whether the application meets F-Droid's privacy, security, and quality expectations.

The developer remains responsible for the code regardless of how it was produced. AI-generated code and assets must not be assumed to be licence-compatible without appropriate review.

### Preparation checklist

Before submitting OpenTick, review the following:

- [ ] Verify the licence of the application and all third-party dependencies.
- [ ] Audit bundled assets, fonts, libraries, SDKs, and other components.
- [ ] Verify the Android application ID and versioning.
- [ ] Ensure the Android build can run using the documented command-line toolchain.
- [ ] Identify proprietary dependencies, tracking libraries, and external services.
- [ ] Document network access, permissions, and any applicable anti-features.
- [ ] Confirm that release tags correspond to the correct source revisions.
- [ ] Prepare the required application metadata, icon, screenshots, and changelogs.
- [ ] Test the build and address issues before requesting inclusion.

This checklist is preparatory; it does not imply that these checks have already been completed.

### Official guidance

- [F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- [F-Droid Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [F-Droid App Developer FAQ](https://f-droid.org/en/docs/FAQ_-_App_Developers/)

The F-Droid maintainers make the final decision about inclusion in the official repository.

## AI-assisted development

Generative AI tools have assisted in the development of OpenTick.

AI is used as a development aid, not as a substitute for responsibility for the resulting software. Code, documentation, and assets must still be reviewed for correctness, security, maintainability, and licensing.

Contributions should be tested before release. Third-party code and generated material should be assessed for provenance and licence compatibility where appropriate.

OpenTick's development process should continue to prioritise:

- Correctness and reliability.
- Maintainable code.
- Testing and verification.
- Transparent development.
- Respect for third-party licences.
- Responsible handling of user data.

## Contributing

Contributions, bug reports, and suggestions are welcome.

### Ways to contribute

- Report reproducible bugs.
- Suggest improvements and new features.
- Improve documentation.
- Fix defects and accessibility issues.
- Test supported platforms.
- Improve build automation and test coverage.
- Review dependencies and security-related changes.

### Contribution workflow

1. Check [existing issues](https://github.com/JebbyCodes/OpenTick/issues) for related reports.
2. Open an issue to discuss substantial changes.
3. Fork the repository and create a branch for your work.
4. Make focused changes and add tests where appropriate.
5. Run relevant builds and checks.
6. Submit a pull request describing the changes and testing performed.

Do not commit credentials, signing keys, passwords, or unrelated generated build output.

Contributions must respect the project's licence and the licences of third-party components.

## Reporting issues

Use [GitHub Issues](https://github.com/JebbyCodes/OpenTick/issues) to report bugs and request features.

When reporting a bug, include:

- OpenTick version or commit.
- Operating system and device, where relevant.
- Steps to reproduce the problem.
- Expected and actual behaviour.
- Relevant error messages or logs.
- Screenshots, if useful and safe to share.

Remove passwords, authentication tokens, personal information, and other sensitive material before posting logs.

## Roadmap

OpenTick's broader development goals include:

- Improving task management and day-to-day usability.
- Refining project planning and Gantt chart integration.
- Improving consistency across supported platforms.
- Strengthening automated testing and release processes.
- Improving accessibility and documentation.
- Reviewing dependencies and privacy characteristics.
- Investigating additional distribution channels, including F-Droid.

These are development priorities rather than guarantees of specific features or release dates.

Follow the [repository](https://github.com/JebbyCodes/OpenTick), [issues](https://github.com/JebbyCodes/OpenTick/issues), and [releases](https://github.com/JebbyCodes/OpenTick/releases) for current progress.

## Licence

OpenTick is distributed under **The Unlicense**, as indicated by the repository's [`LICENSE`](LICENSE) file.

The Unlicense permits use, copying, modification, publication, distribution, sublicensing, and sale, subject to its terms.

Third-party components may have their own licences and conditions. Check the relevant upstream repositories and licence files for details.

For further information, see [The Unlicense](https://unlicense.org/).

---

<p align="center">
  <strong>OpenTick</strong>
  <br>
  Open-source productivity, built in the open.
  <br><br>
  <a href="https://github.com/JebbyCodes/OpenTick">GitHub</a>
  ·
  <a href="https://github.com/JebbyCodes/OpenTick/releases">Releases</a>
  ·
  <a href="https://github.com/JebbyCodes/OpenTick/issues">Issues</a>
  ·
  <a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=opentick">Orion Store</a>
</p>
