#!/bin/bash
# usage: ship.sh <project-dir> <scheme> [project.xcodeproj] — bump build, archive, upload to ASC
set -e
cd "$1"; scheme=${2:-$(basename "$1")}; proj=${3:-$(ls -d *.xcodeproj | head -1)}
[ -f .asc/UploadExportOptions.plist ] || { mkdir -p .asc; printf '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>destination</key><string>upload</string></dict></plist>\n' > .asc/UploadExportOptions.plist; }
arch=".asc/artifacts/$scheme.xcarchive"
# ponytail: date-based build number, sidesteps agvtool/marketing-version failures
asc xcode archive --project "$proj" --scheme "$scheme" --archive-path "$arch" --xcodebuild-flag=CURRENT_PROJECT_VERSION=$(date +%Y%m%d%H%M) --xcodebuild-flag=-allowProvisioningUpdates --overwrite --output json
asc xcode export --archive-path "$arch" --export-options .asc/UploadExportOptions.plist --ipa-path ".asc/artifacts/$scheme.ipa" --xcodebuild-flag=-allowProvisioningUpdates --overwrite --output json
