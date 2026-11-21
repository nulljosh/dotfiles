-- usage: mail.scpt list | read <subject bit>... | delete <subject bit>...
-- ponytail: last 4 days of INBOX/All Mail only, widen when a sweep needs older mail
on run argv
  set cmd to item 1 of argv
  set pats to rest of argv
  tell application "Mail"
    set out to ""
    repeat with a in accounts
      if enabled of a then
        repeat with mb in mailboxes of a
          if name of mb is in {"INBOX", "All Mail"} then
            -- snapshot first: walking the live query breaks once a delete shifts the indexes
            set ms to (messages of mb whose date received > ((current date) - 4 * days))
            repeat with m in ms
              set s to subject of m
              set hit to (cmd is "list")
              repeat with p in pats
                if s contains (p as string) then set hit to true
              end repeat
              if hit then
                set out to out & (name of a) & " | " & (date received of m as string) & " | " & (sender of m) & " | " & s & linefeed
                if cmd is "read" then
                  set c to content of m
                  if (count of c) > 1500 then set c to text 1 thru 1500 of c
                  set out to out & c & linefeed & linefeed
                end if
                if cmd is "delete" then delete m
              end if
            end repeat
          end if
        end repeat
      end if
    end repeat
    return out
  end tell
end run
