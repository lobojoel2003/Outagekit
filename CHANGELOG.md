# Changelog

All notable changes to Outagekit are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). The web app, Android app and the
`@outagekit/runtime` library share one version number.

## [Unreleased]

## [1.0.0] - 2026-11-19

First public release.

### Added

- **Runtime dial.** "Your setup runs 7 hours 20 minutes": a 24-hour dial that
  moves as soon as you change a device, a setting or the battery, and shows the
  clock time the battery would run out if the power went out now.
- **The plan, in order.** What to switch off first (and how much time each
  step buys), what to turn down, when to leave, where to go, what to do when
  the battery runs out, and who to call.
- **Outage mode.** "Power is out" starts a live countdown that keeps the time
  already used when you switch devices off, and can be corrected from the
  charge shown on your battery.
- **Fridge card.** A one-page PDF (Letter or A4) made on the device with
  pdf-lib, in large type for a stressed neighbor or a first responder, plus a
  print view.
- **Charge reminders.** Estimated charge from self-discharge since the last
  top-up, reminders on Android, and a repeating calendar event for any phone.
- **Device catalog.** An open JSON catalog of home medical devices, household
  essentials and power stations, with manufacturer sources where verified.
- **Offline.** Installable progressive web app that works with no internet
  connection; Android app built with Capacitor.
- **`@outagekit/runtime` 1.0.0** (MIT): device watts and duty cycle, inverter
  efficiency and idle draw, DC outputs, battery age and cycle wear, cold-weather
  derating, lead-acid Peukert losses, load-shedding order, leave-by time,
  self-discharge, oxygen cylinder duration and duration formatting.
- Backup and restore of all data as a file. Nothing leaves the device.
- CI for lint, types, unit and end-to-end tests, Android builds, GitHub Pages
  deployment and tagged releases.

[Unreleased]: https://github.com/lobojoel2003/Outagekit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lobojoel2003/Outagekit/releases/tag/v1.0.0
