# fish completion for __NAME__ -*- shell-script -*-

function ____FN___perform_completion
    set -l args (commandline -opc)
    set -l lastArg (commandline -ct)
    set -l results (__BIN__ complete -- $args[2..-1] "$lastArg" 2> /dev/null)

    for line in $results[-1..1]
        if test (string trim -- $line) = ""
            set results $results[1..-2]
        else
            break
        end
    end

    set -l comps $results[1..-2]
    set -l directiveLine $results[-1]
    set -l flagPrefix (string match -r -- '-.*=' "$lastArg")

    for comp in $comps
        printf "%s%s\n" "$flagPrefix" "$comp"
    end
    printf "%s\n" "$directiveLine"
end

function ____FN___perform_completion_once
    if test -n "$____FN___perform_completion_once_result"
        return 0
    end
    set --global ____FN___perform_completion_once_result (____FN___perform_completion)
    if test -z "$____FN___perform_completion_once_result"
        return 1
    end
    return 0
end

function ____FN___clear_perform_completion_once_result
    set --erase ____FN___perform_completion_once_result
end

function ____FN___requires_order_preservation
    ____FN___perform_completion_once
    if test -z "$____FN___perform_completion_once_result"
        return 1
    end
    set -l directive (string sub --start 2 $____FN___perform_completion_once_result[-1])
    set -l shellCompDirectiveKeepOrder 32
    set -l keeporder (math (math --scale 0 $directive / $shellCompDirectiveKeepOrder) % 2)
    if test $keeporder -ne 0
        return 0
    end
    return 1
end

function ____FN___prepare_completions
    set --erase ____FN___comp_results
    ____FN___perform_completion_once
    if test -z "$____FN___perform_completion_once_result"
        return 1
    end

    set -l directive (string sub --start 2 $____FN___perform_completion_once_result[-1])
    set --global ____FN___comp_results $____FN___perform_completion_once_result[1..-2]

    set -l shellCompDirectiveError 1
    set -l shellCompDirectiveNoSpace 2
    set -l shellCompDirectiveNoFileComp 4
    set -l shellCompDirectiveFilterFileExt 8
    set -l shellCompDirectiveFilterDirs 16

    if test -z "$directive"
        set directive 0
    end

    set -l compErr (math (math --scale 0 $directive / $shellCompDirectiveError) % 2)
    if test $compErr -eq 1
        return 1
    end

    set -l filefilter (math (math --scale 0 $directive / $shellCompDirectiveFilterFileExt) % 2)
    set -l dirfilter (math (math --scale 0 $directive / $shellCompDirectiveFilterDirs) % 2)
    if test $filefilter -eq 1; or test $dirfilter -eq 1
        return 1
    end

    set -l nospace (math (math --scale 0 $directive / $shellCompDirectiveNoSpace) % 2)
    set -l nofiles (math (math --scale 0 $directive / $shellCompDirectiveNoFileComp) % 2)

    if test $nospace -ne 0; or test $nofiles -eq 0
        set -l prefix (commandline -t | string escape --style=regex)
        set -l completions (string match -r -- "^$prefix.*" $____FN___comp_results)
        set --global ____FN___comp_results $completions
        set -l numComps (count $____FN___comp_results)

        if test $numComps -eq 1; and test $nospace -ne 0
            set -l split (string split --max 1 "\t" $____FN___comp_results[1])
            set -l lastChar (string sub -s -1 -- $split)
            if not string match -r -q "[@=/:.,]" -- "$lastChar"
                set --global ____FN___comp_results $split[1] $split[1].
            end
        end

        if test $numComps -eq 0; and test $nofiles -eq 0
            return 1
        end
    end

    return 0
end

if type -q "__NAME__"
    complete --do-complete "__NAME__ " > /dev/null 2>&1
end

complete -c __NAME__ -e
complete -c __NAME__ -n '____FN___clear_perform_completion_once_result'
complete -c __NAME__ -n 'not ____FN___requires_order_preservation && ____FN___prepare_completions' -f -a '$____FN___comp_results'
complete -k -c __NAME__ -n '____FN___requires_order_preservation && ____FN___prepare_completions' -f -a '$____FN___comp_results'
