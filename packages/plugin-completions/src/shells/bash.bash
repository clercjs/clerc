# bash completion for __NAME__

____FN___complete() {
    local shellCompDirectiveError=1
    local shellCompDirectiveNoSpace=2
    local shellCompDirectiveNoFileComp=4
    local shellCompDirectiveFilterFileExt=8
    local shellCompDirectiveFilterDirs=16
    local shellCompDirectiveKeepOrder=32

    local cur prev words cword
    if declare -F _get_comp_words_by_ref >/dev/null 2>&1; then
        _get_comp_words_by_ref -n "=:" cur prev words cword
    else
        words=("${COMP_WORDS[@]}")
        cword=${COMP_CWORD}
        cur="${words[cword]}"
    fi

    local -a req_args=()
    local i
    for (( i=1; i<=cword; i++ )); do
        req_args+=("${words[i]}")
    done

    local out
    out=$(__BIN__ complete -- "${req_args[@]}" 2>/dev/null)

    local directive=0
    if [[ "$out" == *:* ]]; then
        directive=${out##*:}
        out=${out%:*}
        out=${out%$'\n'}
    fi

    if [[ $((directive & shellCompDirectiveError)) -ne 0 ]]; then
        return
    fi
    if [[ $((directive & shellCompDirectiveNoSpace)) -ne 0 ]]; then
        compopt -o nospace 2>/dev/null
    fi
    if [[ $((directive & shellCompDirectiveKeepOrder)) -ne 0 ]]; then
        compopt -o nosort 2>/dev/null
    fi
    if [[ $((directive & shellCompDirectiveNoFileComp)) -ne 0 ]]; then
        compopt +o default 2>/dev/null
    fi

    local flagPrefix="" matchCur="$cur"
    if [[ "$cur" == -*=* ]]; then
        flagPrefix="${cur%%=*}="
        matchCur="${cur#*=}"
    fi

    if [[ $((directive & shellCompDirectiveFilterFileExt)) -ne 0 ]]; then
        local filter="" ext
        for ext in $out; do
            filter="${filter:+$filter|}${ext}"
        done
        compopt -o filenames 2>/dev/null
        COMPREPLY=( $(compgen -f -X "!*.($filter)" -- "$matchCur") )
        return
    fi

    if [[ $((directive & shellCompDirectiveFilterDirs)) -ne 0 ]]; then
        compopt -o dirnames 2>/dev/null
        COMPREPLY=( $(compgen -d -- "$matchCur") )
        return
    fi

    local tab=$'\t' line value
    COMPREPLY=()
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        if [[ "$line" == *"$tab"* ]]; then
            value="${line%%$tab*}"
        else
            value="$line"
        fi
        if [[ "$value" == "$matchCur"* ]]; then
            COMPREPLY+=("${flagPrefix}${value}")
        fi
    done <<< "$out"
}

complete -o default -F ____FN___complete __NAME__
