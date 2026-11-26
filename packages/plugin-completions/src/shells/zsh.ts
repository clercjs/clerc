/* eslint-disable no-template-curly-in-string -- Generated shell scripts use literal ${...} parameter expansion */
import { ShellCompDirective } from "../directives";
import type { StaticCompletionSpec } from "../spec";
import { emitPosixHelpers } from "./posix";
import { shQuote } from "./utils";

export function renderZshScript(spec: StaticCompletionSpec): string {
  const { name, bin, fn, hasDynamic, nodes } = spec;
  const entryFn = `_${fn}`;
  const p = `__${fn}`;
  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  const stopNodes = nodes.filter((n) => n.stopParsing !== "none");
  const helpNode = nodes.find((n) => n.isBuiltinHelp);
  const disabledNodes = nodes.filter((n) => n.positionalsDisabled);

  const lines: string[] = [
    `#compdef ${name}`,
    `compdef ${entryFn} ${name}`,
    "",
    `# zsh completion for ${name} -*- shell-script -*-`,
    "",
    ...emitPosixHelpers(spec, true),
  ];

  lines.push(`${entryFn}() {`);
  lines.push("    setopt local_options NO_KSH_ARRAYS BASH_REMATCH");
  lines.push(`    local shellCompDirectiveError=${ShellCompDirective.Error}`);
  lines.push(
    `    local shellCompDirectiveNoSpace=${ShellCompDirective.NoSpace}`,
  );
  lines.push(
    `    local shellCompDirectiveNoFileComp=${ShellCompDirective.NoFileComp}`,
  );
  lines.push(
    `    local shellCompDirectiveFilterFileExt=${ShellCompDirective.FilterFileExt}`,
  );
  lines.push(
    `    local shellCompDirectiveFilterDirs=${ShellCompDirective.FilterDirs}`,
  );
  lines.push(
    `    local shellCompDirectiveKeepOrder=${ShellCompDirective.KeepOrder}`,
  );
  lines.push("");
  lines.push(
    "    local lastParam lastChar flagPrefix directive comp noSpace keepOrder",
  );
  lines.push("    local -a completions");
  lines.push("");
  lines.push(`    words=( "\${=words[1,CURRENT]}" )`);
  lines.push("    lastParam=\${words[-1]}");
  lines.push("    lastChar=\${lastParam[-1]}");
  lines.push("");
  lines.push(`    if [[ "\${lastParam}" =~ '-.*=' ]]; then`);
  lines.push(`        flagPrefix="-P \${BASH_REMATCH}"`);
  lines.push("    fi");
  lines.push("");
  lines.push(`    local -a args_to_quote=("\${(@)words[2,-1]}")`);
  lines.push(
    `    if [[ "\${lastChar}" == "" && "\${args_to_quote[-1]}" != "" ]]; then`,
  );
  lines.push(`        args_to_quote+=("")`);
  lines.push("    fi");
  lines.push("");
  lines.push("    local -a prior=()");
  lines.push(`    local cur=""`);
  lines.push("    if (( \${#args_to_quote} > 1 )); then");
  lines.push(`        prior=("\${(@)args_to_quote[1,-2]}")`);
  lines.push("    fi");
  lines.push("    if (( \${#args_to_quote} >= 1 )); then");
  lines.push(`        cur="\${args_to_quote[-1]}"`);
  lines.push("    fi");
  lines.push("");
  lines.push(
    `    local _node=0 _next_node="" _fl_name="" _fl_takes=0 _fl_inline=0`,
  );
  lines.push(
    `    local _matched_set=" " _plen=\${#prior} _i=1 _tok _tlen _rest _has_eq _fname _j _ch`,
  );
  lines.push("    while (( _i <= _plen )); do");
  lines.push(`        _tok="\${prior[$_i]}"`);
  lines.push("        _tlen=\${#_tok}");
  lines.push(`        if [[ "$_tok" == "--" ]]; then`);
  lines.push("            break");
  lines.push(`        elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then`);
  lines.push(`            _rest="\${_tok[3,-1]}"`);
  lines.push("            _has_eq=0");
  lines.push(`            _fname="$_rest"`);
  lines.push(`            if [[ "$_rest" == *=* ]]; then`);
  lines.push("                _has_eq=1");
  lines.push(`                _fname="\${_rest%%=*}"`);
  lines.push("            fi");
  lines.push(`            ${p}_flag_long "$_node" "$_fname" || break`);
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _has_eq == 0 && _fl_takes == 1 && _i <= _plen )) && ${p}_can_consume "$_node" "\${prior[$_i]}"; then`,
  );
  lines.push("                (( _i++ ))");
  lines.push("            fi");
  lines.push("            continue");
  lines.push(
    `        elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "\${_tok[2]}"; then`,
  );
  lines.push("            local _takes_next=0 _bad_short=0");
  lines.push("            for (( _j=2; _j<=_tlen; _j++ )); do");
  lines.push(`                _ch="\${_tok[$_j]}"`);
  lines.push(`                if ! ${p}_flag_short "$_node" "$_ch"; then`);
  lines.push("                    _bad_short=1; break");
  lines.push("                fi");
  lines.push("                if (( _fl_inline == 1 )); then");
  lines.push(
    "                    if (( _j == _tlen && _fl_takes == 1 )); then _takes_next=1; fi",
  );
  lines.push("                    break");
  lines.push("                fi");
  lines.push("            done");
  lines.push("            (( _bad_short == 1 )) && break");
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _takes_next == 1 && _i <= _plen )) && ${p}_can_consume "$_node" "\${prior[$_i]}"; then`,
  );
  lines.push("                (( _i++ ))");
  lines.push("            fi");
  lines.push("            continue");
  lines.push("        fi");
  lines.push(`        if ${p}_transition "$_node" "$_tok"; then`);
  lines.push("            _node=$_next_node");
  lines.push(`            _matched_set+="$_i "`);
  lines.push("            (( _i++ ))");
  lines.push("            continue");
  lines.push("        fi");
  lines.push("        break");
  lines.push("    done");
  lines.push("");
  lines.push("    local -a _rem=()");
  lines.push(`    if [[ "$_matched_set" == " " ]]; then`);
  lines.push(`        _rem=("\${(@)prior}")`);
  lines.push("    else");
  lines.push("        for (( _i=1; _i<=_plen; _i++ )); do");
  lines.push(`            if [[ "$_matched_set" != *" $_i "* ]]; then`);
  lines.push(`                _rem+=("\${prior[$_i]}")`);
  lines.push("            fi");
  lines.push("        done");
  lines.push("    fi");
  lines.push("");
  lines.push("    local _stop=none");
  if (stopNodes.length > 0) {
    lines.push(`    case "$_node" in`);
    for (const node of stopNodes) {
      lines.push(`        ${node.id}) _stop=${shQuote(node.stopParsing)} ;;`);
    }
    lines.push("    esac");
  }
  lines.push("    local _use_dynamic=0");
  lines.push(`    directive=${ShellCompDirective.NoFileComp}`);
  lines.push(
    "    local -a _result_items=() _emit_list=() _val_items=() _sub_items=() _out_items=()",
  );
  lines.push(
    `    local _val_kind=none _val_delim="" _val_dir=${ShellCompDirective.NoFileComp}`,
  );
  lines.push("");
  if (hasDynamic) {
    lines.push(
      `    if [[ "$_stop" == "dynamic" ]] && (( \${#_rem} > 0 )); then`,
    );
    lines.push("        _use_dynamic=1");
    lines.push("    fi");
  }
  lines.push("    if (( _use_dynamic == 0 )); then");
  lines.push(
    `        local _used=" " _conf=" " _after_dd=0 _stopped=0 _pending=""`,
  );
  lines.push("        local -a _words=() _dd_words=()");
  lines.push("        local _rlen=\${#_rem}");
  lines.push("        _i=1");
  lines.push("        while (( _i <= _rlen )); do");
  lines.push(`            _tok="\${_rem[$_i]}"`);
  lines.push("            _tlen=\${#_tok}");
  lines.push(`            if [[ "$_tok" == "--" ]]; then`);
  lines.push("                _after_dd=1");
  lines.push("                if (( _i < _rlen )); then");
  lines.push(`                    _dd_words=("\${(@)_rem[$(( _i + 1 )),-1]}")`);
  lines.push("                fi");
  lines.push("                break");
  lines.push(`            elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then`);
  lines.push(`                _rest="\${_tok[3,-1]}"`);
  lines.push("                _has_eq=0");
  lines.push(`                _fname="$_rest"`);
  lines.push(`                if [[ "$_rest" == *=* ]]; then`);
  lines.push("                    _has_eq=1");
  lines.push(`                    _fname="\${_rest%%=*}"`);
  lines.push("                fi");
  lines.push(`                if ! ${p}_flag_long "$_node" "$_fname"; then`);
  lines.push(`                    if [[ "$_stop" == "unknown-flag" ]]; then`);
  lines.push("                        _stopped=1");
  lines.push(`                        _words+=("\${(@)_rem[$_i,-1]}")`);
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                    (( _i++ ))");
  lines.push("                    continue");
  lines.push("                fi");
  lines.push("                if (( _fl_inline == 1 )); then");
  lines.push(
    "                    if (( _has_eq == 1 || _fl_takes == 0 )); then",
  );
  lines.push(`                        _used+="f:$_fl_name "`);
  lines.push(
    `                    elif (( _i < _rlen )) && ${p}_can_consume "$_node" "\${_rem[$(( _i + 1 ))]}"; then`,
  );
  lines.push(`                        _used+="f:$_fl_name "`);
  lines.push("                        (( _i++ ))");
  lines.push("                    elif (( _i == _rlen )); then");
  lines.push(`                        _pending="$_fl_name"`);
  lines.push("                    fi");
  lines.push("                else");
  lines.push(`                    _used+="f:$_fl_name "`);
  lines.push("                fi");
  lines.push("                (( _i++ ))");
  lines.push("                continue");
  lines.push(
    `            elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "\${_tok[2]}"; then`,
  );
  lines.push(`                if [[ "$_stop" == "unknown-flag" ]]; then`);
  lines.push("                    local _all_known=1");
  lines.push("                    for (( _j=2; _j<=_tlen; _j++ )); do");
  lines.push(`                        _ch="\${_tok[$_j]}"`);
  lines.push(
    `                        if ! ${p}_flag_short "$_node" "$_ch"; then _all_known=0; break; fi`,
  );
  lines.push(
    "                        if (( _fl_inline == 1 )); then break; fi",
  );
  lines.push("                    done");
  lines.push("                    if (( _all_known == 0 )); then");
  lines.push("                        _stopped=1");
  lines.push(`                        _words+=("\${(@)_rem[$_i,-1]}")`);
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                fi");
  lines.push("                for (( _j=2; _j<=_tlen; _j++ )); do");
  lines.push(`                    _ch="\${_tok[$_j]}"`);
  lines.push(`                    ${p}_flag_short "$_node" "$_ch" || continue`);
  lines.push("                    if (( _fl_inline == 0 )); then");
  lines.push(`                        _used+="f:$_fl_name "`);
  lines.push("                    else");
  lines.push(
    "                        if (( _j < _tlen || _fl_takes == 0 )); then",
  );
  lines.push(`                            _used+="f:$_fl_name "`);
  lines.push(
    `                        elif (( _i < _rlen )) && ${p}_can_consume "$_node" "\${_rem[$(( _i + 1 ))]}"; then`,
  );
  lines.push(`                            _used+="f:$_fl_name "`);
  lines.push("                            (( _i++ ))");
  lines.push("                        elif (( _i == _rlen )); then");
  lines.push(`                            _pending="$_fl_name"`);
  lines.push("                        fi");
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                done");
  lines.push("                (( _i++ ))");
  lines.push("                continue");
  lines.push("            fi");
  lines.push(`            if [[ "$_stop" == "first-positional" ]]; then`);
  lines.push("                _stopped=1");
  lines.push(`                _words+=("\${(@)_rem[$_i,-1]}")`);
  lines.push("                break");
  lines.push("            fi");
  lines.push(`            _words+=("$_tok")`);
  lines.push("            (( _i++ ))");
  lines.push("        done");
  lines.push("");
  lines.push("        local _main_cnt=\${#_words} _dd_cnt=\${#_dd_words}");
  if (nodesWithConflicts.length > 0) {
    lines.push(`        ${p}_conflicts "$_node"`);
  }
  lines.push("        local _handled=0");
  lines.push(`        if [[ -n "$_pending" ]]; then`);
  lines.push(`            ${p}_flag_val "$_node" "$_pending"`);
  lines.push(`            ${p}_apply_flag_val "$cur"`);
  lines.push("            _handled=1");
  lines.push("        fi");
  lines.push(
    "        if (( _handled == 0 && _after_dd == 0 && _stopped == 0 )); then",
  );
  lines.push(`            if [[ "$cur" == -*=* ]]; then`);
  lines.push(
    `                local _lhs="\${cur%%=*}" _rhs="\${cur#*=}" _inline_hit=""`,
  );
  lines.push(`                if [[ "$_lhs" == --* ]]; then`);
  lines.push(
    `                    if ${p}_flag_long "$_node" "\${_lhs[3,-1]}" && (( _fl_inline == 1 )); then`,
  );
  lines.push(`                        _inline_hit="$_fl_name"`);
  lines.push("                    fi");
  lines.push("                elif (( \${#_lhs} >= 2 )); then");
  lines.push("                    local _llen=\${#_lhs}");
  lines.push("                    for (( _j=2; _j<=_llen; _j++ )); do");
  lines.push(
    `                        if ${p}_flag_short "$_node" "\${_lhs[$_j]}" && (( _fl_inline == 1 )); then`,
  );
  lines.push(
    `                            if (( _j == _llen )); then _inline_hit="$_fl_name"; fi`,
  );
  lines.push("                            break");
  lines.push("                        fi");
  lines.push("                    done");
  lines.push("                fi");
  lines.push(`                if [[ -n "$_inline_hit" ]]; then`);
  lines.push(`                    ${p}_flag_val "$_node" "$_inline_hit"`);
  lines.push(`                    ${p}_apply_flag_val "$_rhs"`);
  lines.push("                    _handled=1");
  lines.push("                fi");
  lines.push("            fi");
  lines.push(`            if (( _handled == 0 )) && [[ "$cur" == -* ]]; then`);
  lines.push(`                ${p}_emit_flags "$_node" "$cur"`);
  lines.push(`                _emit_list=("\${_out_items[@]}")`);
  lines.push(`                ${p}_filter_items "" "$cur" 0`);
  lines.push(`                directive=${ShellCompDirective.NoFileComp}`);
  lines.push("                _handled=1");
  lines.push("            fi");
  lines.push("        fi");
  if (helpNode) {
    lines.push(
      `        if (( _handled == 0 && _node == ${helpNode.id} )); then`,
    );
    lines.push("            local _hnode=0 _w _hmiss=0");
    lines.push(`            for _w in "\${_words[@]}"; do`);
    lines.push(
      `                if ! ${p}_transition "$_hnode" "$_w"; then _hmiss=1; break; fi`,
    );
    lines.push("                _hnode=$_next_node");
    lines.push("            done");
    lines.push("            if (( _hmiss == 0 )); then");
    lines.push(`                ${p}_subcmds "$_hnode" 0`);
    lines.push(`                _emit_list=("\${_sub_items[@]}")`);
    lines.push(`                ${p}_filter_items "" "$cur" 0`);
    lines.push("            fi");
    lines.push(`            directive=${ShellCompDirective.NoFileComp}`);
    lines.push("            _handled=1");
    lines.push("        fi");
  }
  lines.push("        if (( _handled == 0 )); then");
  lines.push("            if (( _after_dd == 0 && _main_cnt == 0 )); then");
  lines.push("                local _inc_alias=0");
  lines.push(`                [[ -n "$cur" ]] && _inc_alias=1`);
  lines.push(`                ${p}_subcmds "$_node" "$_inc_alias"`);
  lines.push("            fi");
  if (disabledNodes.length > 0) {
    lines.push(`            case "$_node" in`);
    lines.push(`                ${disabledNodes.map((n) => n.id).join("|")})`);
    lines.push(`                    _emit_list=("\${_sub_items[@]}")`);
    lines.push(`                    ${p}_filter_items "" "$cur" 0`);
    lines.push(
      `                    directive=${ShellCompDirective.NoFileComp}`,
    );
    lines.push("                    _handled=1");
    lines.push("                    ;;");
    lines.push("            esac");
  }
  lines.push("            if (( _handled == 0 )); then");
  lines.push(`                ${p}_pos_val "$_node"`);
  lines.push(`                if [[ "$_val_kind" == "dynamic" ]]; then`);
  lines.push("                    _use_dynamic=1");
  lines.push(`                elif [[ "$_val_kind" == "none" ]]; then`);
  lines.push(`                    _emit_list=("\${_sub_items[@]}")`);
  lines.push(`                    ${p}_filter_items "" "$cur" 0`);
  lines.push(`                    directive=${ShellCompDirective.NoFileComp}`);
  lines.push("                else");
  lines.push("                    directive=$_val_dir");
  lines.push("                    local _skip=0");
  lines.push(
    `                    if (( (directive & (${ShellCompDirective.FilterFileExt} | ${ShellCompDirective.FilterDirs})) != 0 )); then`,
  );
  lines.push("                        _skip=1");
  lines.push("                    fi");
  lines.push(
    `                    _emit_list=("\${_sub_items[@]}" "\${_val_items[@]}")`,
  );
  lines.push(`                    ${p}_filter_items "" "$cur" "$_skip"`);
  lines.push("                fi");
  lines.push("            fi");
  lines.push("        fi");
  lines.push("    fi");
  lines.push("");

  if (hasDynamic) {
    lines.push("    if (( _use_dynamic == 1 )); then");
    lines.push(`        local -a quoted_args=("\${(@q)args_to_quote}")`);
    lines.push(
      `        local requestComp="${bin} complete -- \${quoted_args[*]}"`,
    );
    lines.push("        local out");
    lines.push("        out=$(eval \${requestComp} 2>/dev/null)");
    lines.push("        local -a _dyn_lines");
    lines.push(`        _dyn_lines=("\${(@f)out}")`);
    lines.push(`        local lastLine="\${_dyn_lines[-1]}"`);
    lines.push(`        if [[ "\${lastLine[1]}" == ":" ]]; then`);
    lines.push(`            directive="\${lastLine[2,-1]}"`);
    lines.push("            if (( \${#_dyn_lines} > 1 )); then");
    lines.push(`                _result_items=("\${(@)_dyn_lines[1,-2]}")`);
    lines.push("            else");
    lines.push("                _result_items=()");
    lines.push("            fi");
    lines.push("        else");
    lines.push("            directive=0");
    lines.push(`            _result_items=("\${(@)_dyn_lines}")`);
    lines.push("        fi");
    lines.push("    fi");
    lines.push("");
  }

  lines.push("    if (( (directive & shellCompDirectiveError) != 0 )); then");
  lines.push("        return");
  lines.push("    fi");
  lines.push("");
  lines.push(`    local _tab=$'\\t'`);
  lines.push(`    for comp in "\${_result_items[@]}"; do`);
  lines.push(`        if [[ -n "$comp" ]]; then`);
  lines.push("            comp=\${comp//:/\\\\:}");
  lines.push("            comp=\${comp//$_tab/:}");
  lines.push(`            completions+=("$comp")`);
  lines.push("        fi");
  lines.push("    done");
  lines.push("");
  lines.push("    if (( (directive & shellCompDirectiveNoSpace) != 0 )); then");
  lines.push(`        noSpace="-S ''"`);
  lines.push("    fi");
  lines.push(
    "    if (( (directive & shellCompDirectiveKeepOrder) != 0 )); then",
  );
  lines.push(`        keepOrder="-V"`);
  lines.push("    fi");
  lines.push("");
  lines.push(
    "    if (( (directive & shellCompDirectiveFilterFileExt) != 0 )); then",
  );
  lines.push(`        local filteringCmd='_files'`);
  lines.push("        local filter");
  lines.push("        for filter in \${completions[@]}; do");
  lines.push(`            if [[ "\${filter[1]}" != '*' ]]; then`);
  lines.push(`                filter="\\*.$filter"`);
  lines.push("            fi");
  lines.push(`            filteringCmd+=" -g $filter"`);
  lines.push("        done");
  lines.push(`        filteringCmd+=" \${flagPrefix}"`);
  lines.push(`        _arguments '*:filename:'"$filteringCmd"`);
  lines.push(
    "    elif (( (directive & shellCompDirectiveFilterDirs) != 0 )); then",
  );
  lines.push(`        local subdir="\${completions[1]}"`);
  lines.push(`        if [[ -n "$subdir" ]]; then`);
  lines.push(`            pushd "\${subdir}" >/dev/null 2>&1`);
  lines.push("        fi");
  lines.push("        local result");
  lines.push(`        _arguments '*:dirname:_files -/'" \${flagPrefix}"`);
  lines.push("        result=$?");
  lines.push(`        if [[ -n "$subdir" ]]; then`);
  lines.push("            popd >/dev/null 2>&1");
  lines.push("        fi");
  lines.push("        return $result");
  lines.push("    else");
  lines.push(
    `        if eval _describe $keepOrder "completions" completions -Q \${flagPrefix} \${noSpace}; then`,
  );
  lines.push("            return 0");
  lines.push(
    "        elif (( (directive & shellCompDirectiveNoFileComp) != 0 )); then",
  );
  lines.push("            return 0");
  lines.push("        else");
  lines.push(`            _arguments '*:filename:_files'" \${flagPrefix}"`);
  lines.push("        fi");
  lines.push("    fi");
  lines.push("}");
  lines.push("");
  lines.push(`if [[ "\${funcstack[1]}" == "${entryFn}" ]]; then`);
  lines.push(`    ${entryFn}`);
  lines.push("fi");

  return lines.join("\n");
}
