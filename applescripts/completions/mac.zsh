#compdef mac

_mac() {
    local state line
    typeset -A opt_args

    local -a tools
    tools=(
        'music:Apple Music control'
        'app:Application management'
        'win:Window management'
        'sys:System settings'
        'clip:Clipboard management'
        'find:File finder'
        'note:Notes management'
        'cal:Calendar'
        'rem:Reminders'
        'safari:Safari control'
        'screen:Screen capture'
        'say:Text to speech'
        'focus:Focus/DND modes'
        'mail:Mail control'
        'contact:Contacts'
        'disk:Disk utilities'
        'net:Network utilities'
        'proc:Process management'
        'key:Keychain access'
        'input:Input device settings'
        'help:Show help'
        'version:Show version'
        'status:System status'
        'context:Context save/restore'
    )

    _arguments -C \
        '1: :->tool' \
        '2: :->subcmd' \
        '*: :->args'

    case $state in
        tool)
            _describe 'tool' tools
            ;;
        subcmd)
            local -a subcmds
            case $words[2] in
                music)
                    subcmds=(
                        'play:Play current track'
                        'pause:Pause playback'
                        'resume:Resume playback'
                        'next:Next track'
                        'prev:Previous track'
                        'now:Now playing'
                        'vol:Volume control'
                        'shuffle:Toggle shuffle'
                        'dj-start:Start DJ mode'
                        'dj-stop:Stop DJ mode'
                        'dj-status:DJ mode status'
                        'playlist:Playlist management'
                        'queue:Show queue'
                        'rate:Rate track'
                        'love:Love track'
                        'dislike:Dislike track'
                        'lyrics:Show lyrics'
                        'history:Play history'
                        'search:Search library'
                        'stats:Library stats'
                    )
                    ;;
                app)
                    subcmds=(
                        'open:Open application'
                        'quit:Quit application'
                        'kill:Force kill application'
                        'restart:Restart application'
                        'running:List running apps'
                        'check:Check if app is running'
                        'front:Frontmost application'
                        'hide:Hide application'
                        'show:Show application'
                        'pid:Get PID of application'
                        'windows:List app windows'
                    )
                    ;;
                win)
                    subcmds=(
                        'list:List windows'
                        'focus:Focus window'
                        'move:Move window'
                        'resize:Resize window'
                        'bounds:Get window bounds'
                        'left:Snap to left half'
                        'right:Snap to right half'
                        'max:Maximize window'
                        'center:Center window'
                        'corners:Snap to corners'
                        'stack:Stack windows'
                        'minimize:Minimize window'
                        'fullscreen:Toggle fullscreen'
                        'layout:Apply layout'
                        'thirds:Split into thirds'
                        'swap:Swap windows'
                        'restore:Restore window'
                    )
                    ;;
                sys)
                    subcmds=(
                        'dark:Toggle dark mode'
                        'volume:System volume'
                        'brightness:Display brightness'
                        'lock:Lock screen'
                        'sleep:Sleep system'
                        'caffeine:Prevent sleep'
                        'battery:Battery status'
                        'wifi:Wi-Fi control'
                        'bluetooth:Bluetooth control'
                        'uptime:System uptime'
                        'ram:RAM usage'
                        'cpu:CPU usage'
                        'temp:Temperature sensors'
                        'display:Display settings'
                        'trash:Trash operations'
                        'hostname:Get/set hostname'
                    )
                    ;;
                clip)
                    subcmds=(
                        'copy:Copy to clipboard'
                        'paste:Paste from clipboard'
                        'history:Clipboard history'
                        'clear:Clear clipboard'
                    )
                    ;;
                find)
                    subcmds=(
                        'open:Find and open file'
                        'reveal:Reveal in Finder'
                        'trash:Move file to trash'
                        'info:File info'
                        'search:Search for files'
                    )
                    ;;
                disk)
                    subcmds=(
                        'usage:Disk usage'
                        'largest:Largest files'
                        'cleanup:Cleanup disk'
                        'volumes:List volumes'
                        'snapshot:Manage snapshots'
                    )
                    ;;
                net)
                    subcmds=(
                        'ip:Get IP address'
                        'dns:DNS lookup'
                        'ping:Ping host'
                        'speed:Speed test'
                        'ports:Open ports'
                        'flush:Flush DNS cache'
                        'proxy:Proxy settings'
                    )
                    ;;
                proc)
                    subcmds=(
                        'top:Top processes by CPU'
                        'top-mem:Top processes by memory'
                        'find:Find process'
                        'kill:Kill process'
                        'watch:Watch process'
                        'zombie:List zombie processes'
                    )
                    ;;
                key)
                    subcmds=(
                        'get:Get keychain item'
                        'set:Set keychain item'
                        'list:List keychain items'
                        'delete:Delete keychain item'
                    )
                    ;;
                input)
                    subcmds=(
                        'trackpad:Trackpad settings'
                        'mouse:Mouse settings'
                        'scroll:Scroll settings'
                        'key-repeat:Key repeat settings'
                        'keyboard:Keyboard settings'
                    )
                    ;;
                focus)
                    subcmds=(
                        'on:Enable focus mode'
                        'off:Disable focus mode'
                        'status:Focus mode status'
                        'list:List focus modes'
                    )
                    ;;
                screen)
                    subcmds=(
                        'capture:Capture screenshot'
                        'record:Record screen'
                        'resolution:Screen resolution'
                    )
                    ;;
                say)
                    subcmds=(
                        'say:Speak text'
                    )
                    ;;
                note)
                    subcmds=(
                        'add:Add note'
                        'list:List notes'
                        'show:Show note'
                        'search:Search notes'
                        'delete:Delete note'
                    )
                    ;;
                cal)
                    subcmds=(
                        'today:Todays events'
                        'week:This weeks events'
                        'add:Add event'
                        'list:List events'
                    )
                    ;;
                rem)
                    subcmds=(
                        'add:Add reminder'
                        'list:List reminders'
                        'done:Mark done'
                        'delete:Delete reminder'
                    )
                    ;;
                safari)
                    subcmds=(
                        'url:Get current URL'
                        'title:Get page title'
                        'tabs:List open tabs'
                        'open:Open URL'
                        'close:Close tab'
                        'reading-list:Reading list'
                    )
                    ;;
                mail)
                    subcmds=(
                        'unread:Unread count'
                        'send:Send email'
                        'check:Check for new mail'
                    )
                    ;;
                contact)
                    subcmds=(
                        'find:Find contact'
                        'list:List contacts'
                        'add:Add contact'
                    )
                    ;;
                context)
                    subcmds=(
                        'save:Save context'
                        'restore:Restore context'
                        'list:List saved contexts'
                        'delete:Delete context'
                    )
                    ;;
                status|help|version)
                    subcmds=()
                    ;;
            esac
            if (( ${#subcmds[@]} > 0 )); then
                _describe 'subcommand' subcmds
            fi
            ;;
    esac
}

_mac "$@"
