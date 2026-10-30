#!/bin/sh
# Copy the brand files the site shares with the repo (tokens, mark, icon), then deploy the Worker.
set -e
cd "$(dirname "$0")"
cp brand/tokens.css brand/mark.svg icon.svg landing/
[ "$1" = "--copy-only" ] && exit 0
npx wrangler deploy
