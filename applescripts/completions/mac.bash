_mac_completion() {
    local cur prev words cword
    _init_completion || return

    local tools="music app win sys clip find note cal rem safari screen say focus mail contact disk net proc key input help version status context"

    local music_cmds="play pause resume next prev now vol shuffle dj-start dj-stop dj-status playlist queue rate love dislike lyrics history search stats"
    local app_cmds="open quit kill restart running check front hide show pid windows"
    local win_cmds="list focus move resize bounds left right max center corners stack minimize fullscreen layout thirds swap restore"
    local sys_cmds="dark volume brightness lock sleep caffeine battery wifi bluetooth uptime ram cpu temp display trash hostname"
    local clip_cmds="copy paste history clear"
    local find_cmds="open reveal trash info search"
    local disk_cmds="usage largest cleanup volumes snapshot"
    local net_cmds="ip dns ping speed ports flush proxy"
    local proc_cmds="top top-mem find kill watch zombie"
    local key_cmds="get set list delete"
    local input_cmds="trackpad mouse scroll key-repeat keyboard"
    local focus_cmds="on off status list"
    local screen_cmds="capture record resolution"
    local say_cmds="say"
    local note_cmds="add list show search delete"
    local cal_cmds="today week add list"
    local rem_cmds="add list done delete"
    local safari_cmds="url title tabs open close reading-list"
    local mail_cmds="unread send check"
    local contact_cmds="find list add"
    local context_cmds="save restore list delete"

    if [[ $cword -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "$tools" -- "$cur") )
        return
    fi

    if [[ $cword -eq 2 ]]; then
        local tool="${words[1]}"
        local subcmds=""
        case "$tool" in
            music)   subcmds="$music_cmds" ;;
            app)     subcmds="$app_cmds" ;;
            win)     subcmds="$win_cmds" ;;
            sys)     subcmds="$sys_cmds" ;;
            clip)    subcmds="$clip_cmds" ;;
            find)    subcmds="$find_cmds" ;;
            disk)    subcmds="$disk_cmds" ;;
            net)     subcmds="$net_cmds" ;;
            proc)    subcmds="$proc_cmds" ;;
            key)     subcmds="$key_cmds" ;;
            input)   subcmds="$input_cmds" ;;
            focus)   subcmds="$focus_cmds" ;;
            screen)  subcmds="$screen_cmds" ;;
            say)     subcmds="$say_cmds" ;;
            note)    subcmds="$note_cmds" ;;
            cal)     subcmds="$cal_cmds" ;;
            rem)     subcmds="$rem_cmds" ;;
            safari)  subcmds="$safari_cmds" ;;
            mail)    subcmds="$mail_cmds" ;;
            contact) subcmds="$contact_cmds" ;;
            context) subcmds="$context_cmds" ;;
            status|help|version) subcmds="" ;;
        esac
        if [[ -n "$subcmds" ]]; then
            COMPREPLY=( $(compgen -W "$subcmds" -- "$cur") )
        fi
        return
    fi
}

complete -F _mac_completion mac
