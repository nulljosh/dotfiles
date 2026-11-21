on run argv
  tell application "Safari"
    repeat with w in windows
      repeat with t in tabs of w
        if (URL of t) contains "producthunt.com" then return (do JavaScript (item 1 of argv) in t)
      end repeat
    end repeat
    return "NO PH TAB"
  end tell
end run
