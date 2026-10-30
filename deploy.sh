#!/bin/sh
# Copy the icon the landing shares with the README, then deploy the Worker.
set -e
cd "$(dirname "$0")"
cp icon.svg landing/
[ "$1" = "--copy-only" ] && exit 0
npx wrangler deploy
