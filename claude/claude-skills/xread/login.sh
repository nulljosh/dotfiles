#!/bin/sh
# one-time: plain Chrome (no automation flags) with its own profile; log in to X, leave it or close it.
# later runs: same command starts it headless-capable; check.mjs/scrape attach over CDP on :9333.
open -na "Google Chrome" --args --user-data-dir="$HOME/.xreader/profile" --remote-debugging-port=9333 --no-first-run https://x.com/login
