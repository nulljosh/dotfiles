---
name: asc-system-status
description: Check Apple's System Status page before assuming an asc CLI failure is a bug. Use when an asc command fails unexpectedly, returns auth/server errors, times out, or behaves inconsistently, or when asked if App Store Connect / the developer portal / TestFlight is down.
---

# asc system status check

Apple's outages get misdiagnosed as `asc` bugs. Before deep-troubleshooting an `asc` failure, rule out an Apple-side outage first.

## Check
- `WebFetch` `https://developer.apple.com/system-status/` and look at the status of the services relevant to the failing command:
  - App Store Connect
  - App Store Connect API
  - Developer Portal / Certificates, Identifiers & Profiles
  - TestFlight
  - Apple ID
- Anything other than "Available" (e.g. "Performance Degradation", "Service Disruption") on a relevant service is the likely cause.

## Outcome
- If a relevant service is degraded/down: tell the user that's the cause, skip further `asc` debugging, suggest retrying later.
- If everything is green: it's not Apple's status page — continue normal troubleshooting (see `asc-cli-usage` skill).
