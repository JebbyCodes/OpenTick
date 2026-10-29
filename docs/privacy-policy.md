# OpenTick Privacy Policy

**Last updated:** 28 October 2026

## 1. Introduction

OpenTick is a free, open-source task management and productivity application developed by JebbyCodes. This privacy policy explains how OpenTick handles information when you use the application.

OpenTick is designed to work locally on your device without requiring an account, subscription, or developer-operated cloud service.

## 2. Information collected by OpenTick

OpenTick is designed not to collect or transmit your personal information to the developer. It has no analytics, advertising, crash reporting or telemetry.

Information you enter into the application, such as tasks, notes, templates, projects, timetables, holidays, habits, attachments and other productivity data, is stored locally on your device.

OpenTick does not require you to provide a name, email address, or other account details to use its core functionality.

## 3. Local storage and control of your data

Your locally stored application data remains under your control. You can export it, back it up, or delete it from Settings → Data & sync, and, where applicable, through the storage facilities provided by your operating system.

Uninstalling OpenTick may not remove every file containing application data. Back up any important information before uninstalling or resetting the application.

Settings such as theme, accessibility options, keyboard hints and background-service choices are stored on the device only and are never synced.

## 4. Optional sync and backups

Sync is off by default. If you turn it on, OpenTick copies your data to a location **you** choose and control (for example a WebDAV server, a Git repository, an S3-compatible bucket, or a file in a folder). The developer does not operate this service and cannot see your data. The provider you pick has its own privacy policy, and whoever runs that server can read what is stored there unless you turn on encryption.

Sync credentials (such as a password or token) are kept on your device only and are not included in the synced data.

## 5. Encryption

You can protect your data with a passphrase in Settings → Encryption. When enabled, the data stored on this device, in automatic backups, and in sync files is encrypted with AES-256-GCM using a key derived from your passphrase. Without the passphrase (or the recovery key you were shown) the data cannot be read, and the developer cannot recover it for you.

When encryption is on, home-screen widgets, the tray menu and background notifications show only generic text, unless you choose to allow a readable summary for them.

## 6. Notifications and the background service

OpenTick can show reminders for tasks, lessons and timetable slots, and an optional daily summary. These are created on your device from your own data.

To make sure reminders are not missed, OpenTick can run in the background: on desktop it can stay in the system tray, start when you sign in, and notify while the window is closed; on Android it can schedule alarms, restart them after the device reboots, and show an optional persistent notification with your current and next lesson. All of this happens on your device. Nothing is sent to the developer or to any server. You can turn each part off in Settings → Notifications.

## 7. Permissions

Depending on the platform, OpenTick may ask for:

- **Notifications** – to show reminders and the optional persistent timetable notification.
- **Run at start-up / receive boot completed (Android), launch at login (desktop)** – to restore reminders and the background service after a restart.
- **Exact alarms (Android)** – so reminders arrive on time.
- **Foreground service (Android)** – only for the optional persistent timetable notification.
- **File access** – only for files you choose to attach, import or export.

OpenTick does not request access to your contacts, location, camera, microphone or accounts.

## 8. Network connections and third-party services

OpenTick makes network requests only when you ask it to: for example to sync with the provider you configured, or to load an embedded video, audio or web player that you put in a note. Those services are governed by their own privacy policies.

Third-party services that you access independently, including GitHub when viewing the project's website or reporting an issue, are governed by their own privacy policies.

If future versions introduce optional online features, integrations, or telemetry, this policy will be updated to describe the relevant data handling.

## 9. Data sharing and sale

The developer does not sell personal information collected through OpenTick. OpenTick is not intended to transmit the contents of your tasks, notes, templates, or projects to the developer.

## 10. Children's privacy

OpenTick is a general-purpose productivity application. The developer does not intentionally collect personal information from children through the application.

## 11. Security

Keeping your device secure and maintaining backups helps protect your locally stored information. You are responsible for the security of your device, your passphrase and any backups you create.

## 12. Changes to this policy

This privacy policy may be updated when OpenTick's features or data practices change. The latest version is published with the project and is shown inside the app (Settings → About & privacy).

## 13. Contact

For questions about this privacy policy or OpenTick's privacy practices, contact the developer through the project's GitHub repository:

https://github.com/JebbyCodes/OpenTick
