#!/bin/sh
cd ~/Documents/Code/lec || exit 1
pkill -x LEC
xcodebuild -project LEC.xcodeproj -scheme LEC -destination 'platform=macOS' -quiet -derivedDataPath /tmp/lecdd build 2>&1 | grep -E "\.swift.*error" && exit 1
rm -rf /Applications/LEC.app && cp -R /tmp/lecdd/Build/Products/Debug/LEC.app /Applications/ && open -g /Applications/LEC.app
sleep 25
echo "course: $(defaults read com.heyitsmejosh.lec courseOU) $(defaults read com.heyitsmejosh.lec courseName)"
id=$(swift -e 'import CoreGraphics; let l = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as! [[String: Any]]; var best = (0, 0.0); for w in l where (w["kCGWindowOwnerName"] as? String) == "LEC" { let a = ((w["kCGWindowBounds"] as? [String: Any])?["Width"] as? Double ?? 0) * ((w["kCGWindowBounds"] as? [String: Any])?["Height"] as? Double ?? 0); if a > best.1 { best = (w["kCGWindowNumber"] as! Int, a) } }; print(best.0)' 2>/dev/null)
mkdir -p /tmp/lecshot && screencapture -x -o -l"$id" /tmp/lecshot/dogfood.png && echo "shot: /tmp/lecshot/dogfood.png"
