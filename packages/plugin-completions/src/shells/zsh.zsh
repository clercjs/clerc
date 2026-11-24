#compdef __NAME__
compdef ___FN__ __NAME__

# zsh completion for __NAME__ -*- shell-script -*-

___FN__() {
    local shellCompDirectiveError=1
    local shellCompDirectiveNoSpace=2
    local shellCompDirectiveNoFileComp=4
    local shellCompDirectiveFilterFileExt=8
    local shellCompDirectiveFilterDirs=16
    local shellCompDirectiveKeepOrder=32

    local lastParam lastChar flagPrefix requestComp out directive comp noSpace keepOrder
    local -a completions

    words=( "${=words[1,CURRENT]}" )
    lastParam=${words[-1]}
    lastChar=${lastParam[-1]}

    setopt local_options BASH_REMATCH
    if [[ "${lastParam}" =~ '-.*=' ]]; then
        flagPrefix="-P ${BASH_REMATCH}"
    fi

    local -a args_to_quote=("${(@)words[2,-1]}")
    if [ "${lastChar}" = "" ] && [ "${args_to_quote[-1]}" != "" ]; then
        args_to_quote+=("")
    fi

    local quoted_args=("${(@q)args_to_quote}")
    requestComp="__BIN__ complete -- ${quoted_args[*]}"
    out=$(eval ${requestComp} 2>/dev/null)

    local lastLine
    while IFS='\n' read -r line; do
        lastLine=${line}
    done < <(printf "%s\n" "${out[@]}")

    if [ "${lastLine[1]}" = : ]; then
        directive=${lastLine[2,-1]}
        local suffix
        (( suffix=${#lastLine}+2 ))
        out=${out[1,-$suffix]}
    else
        directive=0
    fi

    if [ $((directive & shellCompDirectiveError)) -ne 0 ]; then
        return
    fi

    while IFS='\n' read -r comp; do
        if [ -n "$comp" ]; then
            comp=${comp//:/\\:}
            local tab="$(printf '\t')"
            comp=${comp//$tab/:}
            completions+=${comp}
        fi
    done < <(printf "%s\n" "${out[@]}")

    if [ $((directive & shellCompDirectiveNoSpace)) -ne 0 ]; then
        noSpace="-S ''"
    fi
    if [ $((directive & shellCompDirectiveKeepOrder)) -ne 0 ]; then
        keepOrder="-V"
    fi

    if [ $((directive & shellCompDirectiveFilterFileExt)) -ne 0 ]; then
        local filteringCmd='_files'
        for filter in ${completions[@]}; do
            if [ ${filter[1]} != '*' ]; then
                filter="\*.$filter"
            fi
            filteringCmd+=" -g $filter"
        done
        filteringCmd+=" ${flagPrefix}"
        _arguments '*:filename:'"$filteringCmd"
    elif [ $((directive & shellCompDirectiveFilterDirs)) -ne 0 ]; then
        local subdir="${completions[1]}"
        if [ -n "$subdir" ]; then
            pushd "${subdir}" >/dev/null 2>&1
        fi
        local result
        _arguments '*:dirname:_files -/'" ${flagPrefix}"
        result=$?
        if [ -n "$subdir" ]; then
            popd >/dev/null 2>&1
        fi
        return $result
    else
        if eval _describe $keepOrder "completions" completions -Q ${flagPrefix} ${noSpace}; then
            return 0
        elif [ $((directive & shellCompDirectiveNoFileComp)) -ne 0 ]; then
            return 0
        else
            _arguments '*:filename:_files'" ${flagPrefix}"
        fi
    fi
}

if [ "${funcstack[1]}" = "___FN__" ]; then
    ___FN__
fi
