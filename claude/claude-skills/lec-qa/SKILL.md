---
name: lec-qa
description: Run the LEC app's QA gate (iOS build, macOS app tests, LECKit tests) and report pass/fail. Use when the user says /lec-qa or asks to test the LEC school app.
---
Run `~/Documents/Code/lec/scripts/qa.sh`. It prints "QA green" on success. On failure show the first compiler or XCTest error, fix it, rerun. Never push LEC changes on a red run.
