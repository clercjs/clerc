/* eslint-disable no-template-curly-in-string -- Generated shell scripts use literal ${...} parameter expansion */
import { ShellCompDirective } from "../directives";
import type { StaticCompletionSpec } from "../spec";
import { emitPosixHelpers } from "./posix";
import { shQuote } from "./utils";

export function renderBashScript(spec: StaticCompletionSpec): string {
  const { name, bin, fn, hasDynamic, nodes } = spec;
  const p = `__${fn}`;
  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  const stopNodes = nodes.filter((n) => n.stopParsing !== "none");
  const helpNode = nodes.find((n) => n.isBuiltinHelp);
  const disabledNodes = nodes.filter((n) => n.positionalsDisabled);

  const lines: string[] = [
    `# bash completion for ${name}`,
    "",
    ...emitPosixHelpers(spec, false),
  ];

  lines.push(`${p}_complete() {`);
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
  lines.push("    local cur prev words cword");
  lines.push("    if declare -F _get_comp_words_by_ref >/dev/null 2>&1; then");
  lines.push(`        _get_comp_words_by_ref -n "=:" cur prev words cword`);
  lines.push("    else");
  lines.push('        words=("${COMP_WORDS[@]}")');
  lines.push("        cword=${COMP_CWORD}");
  lines.push('        cur="${words[cword]}"');
  lines.push("    fi");
  lines.push("");
  lines.push("    local -a req_args=() prior=()");
  lines.push("    local i");
  lines.push("    for (( i=1; i<=cword; i++ )); do");
  lines.push('        req_args+=("${words[i]}")');
  lines.push("        if (( i < cword )); then");
  lines.push('            prior+=("${words[i]}")');
  lines.push("        fi");
  lines.push("    done");
  lines.push("");
  lines.push(
    '    local _node=0 _next_node="" _fl_name="" _fl_takes=0 _fl_inline=0',
  );
  lines.push(
    '    local _matched_set=" " _plen=${#prior[@]} _i=0 _tok _tlen _rest _has_eq _fname _j _ch',
  );
  lines.push("    while (( _i < _plen )); do");
  lines.push('        _tok="${prior[_i]}"');
  lines.push("        _tlen=${#_tok}");
  lines.push('        if [[ "$_tok" == "--" ]]; then');
  lines.push("            break");
  lines.push('        elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then');
  lines.push('            _rest="${_tok:2}"');
  lines.push("            _has_eq=0");
  lines.push('            _fname="$_rest"');
  lines.push('            if [[ "$_rest" == *=* ]]; then');
  lines.push("                _has_eq=1");
  lines.push('                _fname="${_rest%%=*}"');
  lines.push("            fi");
  lines.push(`            ${p}_flag_long "$_node" "$_fname" || break`);
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _has_eq == 0 && _fl_takes == 1 && _i < _plen )) && ${p}_can_consume "$_node" "\${prior[_i]}"; then`,
  );
  lines.push("                (( _i++ ))");
  lines.push("            fi");
  lines.push("            continue");
  lines.push(
    `        elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "\${_tok:1:1}"; then`,
  );
  lines.push("            local _takes_next=0 _bad_short=0");
  lines.push("            for (( _j=1; _j<_tlen; _j++ )); do");
  lines.push('                _ch="${_tok:_j:1}"');
  lines.push(`                if ! ${p}_flag_short "$_node" "$_ch"; then`);
  lines.push("                    _bad_short=1; break");
  lines.push("                fi");
  lines.push("                if (( _fl_inline == 1 )); then");
  lines.push(
    "                    if (( _j == _tlen - 1 && _fl_takes == 1 )); then _takes_next=1; fi",
  );
  lines.push("                    break");
  lines.push("                fi");
  lines.push("            done");
  lines.push("            (( _bad_short == 1 )) && break");
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _takes_next == 1 && _i < _plen )) && ${p}_can_consume "$_node" "\${prior[_i]}"; then`,
  );
  lines.push("                (( _i++ ))");
  lines.push("            fi");
  lines.push("            continue");
  lines.push("        fi");
  lines.push(`        if ${p}_transition "$_node" "$_tok"; then`);
  lines.push("            _node=$_next_node");
  lines.push('            _matched_set+="$_i "');
  lines.push("            (( _i++ ))");
  lines.push("            continue");
  lines.push("        fi");
  lines.push("        break");
  lines.push("    done");
  lines.push("");
  lines.push("    local -a _rem=()");
  lines.push('    if [[ "$_matched_set" == " " ]]; then');
  lines.push('        _rem=("${prior[@]}")');
  lines.push("    else");
  lines.push("        for (( _i=0; _i<_plen; _i++ )); do");
  lines.push('            if [[ "$_matched_set" != *" $_i "* ]]; then');
  lines.push('                _rem+=("${prior[_i]}")');
  lines.push("            fi");
  lines.push("        done");
  lines.push("    fi");
  lines.push("");
  lines.push("    local _stop=none");
  if (stopNodes.length > 0) {
    lines.push('    case "$_node" in');
    for (const node of stopNodes) {
      lines.push(`        ${node.id}) _stop=${shQuote(node.stopParsing)} ;;`);
    }
    lines.push("    esac");
  }
  lines.push(
    `    local _use_dynamic=0 directive=${ShellCompDirective.NoFileComp}`,
  );
  lines.push(
    "    local -a _result_items=() _emit_list=() _val_items=() _sub_items=() _out_items=()",
  );
  lines.push(
    `    local _val_kind=none _val_delim="" _val_dir=${ShellCompDirective.NoFileComp}`,
  );
  lines.push("");
  if (hasDynamic) {
    lines.push(
      '    if [[ "$_stop" == "dynamic" ]] && (( ${#_rem[@]} > 0 )); then',
    );
    lines.push("        _use_dynamic=1");
    lines.push("    fi");
  }
  lines.push("    if (( _use_dynamic == 0 )); then");
  lines.push(
    '        local _used=" " _conf=" " _after_dd=0 _stopped=0 _pending=""',
  );
  lines.push("        local -a _words=() _dd_words=()");
  lines.push("        local _rlen=${#_rem[@]}");
  lines.push("        _i=0");
  lines.push("        while (( _i < _rlen )); do");
  lines.push('            _tok="${_rem[_i]}"');
  lines.push("            _tlen=${#_tok}");
  lines.push('            if [[ "$_tok" == "--" ]]; then');
  lines.push("                _after_dd=1");
  lines.push('                _dd_words=("${_rem[@]:_i+1}")');
  lines.push("                break");
  lines.push('            elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then');
  lines.push('                _rest="${_tok:2}"');
  lines.push("                _has_eq=0");
  lines.push('                _fname="$_rest"');
  lines.push('                if [[ "$_rest" == *=* ]]; then');
  lines.push("                    _has_eq=1");
  lines.push('                    _fname="${_rest%%=*}"');
  lines.push("                fi");
  lines.push(`                if ! ${p}_flag_long "$_node" "$_fname"; then`);
  lines.push('                    if [[ "$_stop" == "unknown-flag" ]]; then');
  lines.push("                        _stopped=1");
  lines.push('                        _words+=("${_rem[@]:_i}")');
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                    (( _i++ ))");
  lines.push("                    continue");
  lines.push("                fi");
  lines.push("                if (( _fl_inline == 1 )); then");
  lines.push(
    "                    if (( _has_eq == 1 || _fl_takes == 0 )); then",
  );
  lines.push('                        _used+="f:$_fl_name "');
  lines.push(
    `                    elif (( _i + 1 < _rlen )) && ${p}_can_consume "$_node" "\${_rem[_i+1]}"; then`,
  );
  lines.push('                        _used+="f:$_fl_name "');
  lines.push("                        (( _i++ ))");
  lines.push("                    elif (( _i == _rlen - 1 )); then");
  lines.push('                        _pending="$_fl_name"');
  lines.push("                    fi");
  lines.push("                else");
  lines.push('                    _used+="f:$_fl_name "');
  lines.push("                fi");
  lines.push("                (( _i++ ))");
  lines.push("                continue");
  lines.push(
    `            elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "\${_tok:1:1}"; then`,
  );
  lines.push('                if [[ "$_stop" == "unknown-flag" ]]; then');
  lines.push("                    local _all_known=1");
  lines.push("                    for (( _j=1; _j<_tlen; _j++ )); do");
  lines.push('                        _ch="${_tok:_j:1}"');
  lines.push(
    `                        if ! ${p}_flag_short "$_node" "$_ch"; then _all_known=0; break; fi`,
  );
  lines.push(
    "                        if (( _fl_inline == 1 )); then break; fi",
  );
  lines.push("                    done");
  lines.push("                    if (( _all_known == 0 )); then");
  lines.push("                        _stopped=1");
  lines.push('                        _words+=("${_rem[@]:_i}")');
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                fi");
  lines.push("                for (( _j=1; _j<_tlen; _j++ )); do");
  lines.push('                    _ch="${_tok:_j:1}"');
  lines.push(`                    ${p}_flag_short "$_node" "$_ch" || continue`);
  lines.push("                    if (( _fl_inline == 0 )); then");
  lines.push('                        _used+="f:$_fl_name "');
  lines.push("                    else");
  lines.push(
    "                        if (( _j + 1 < _tlen || _fl_takes == 0 )); then",
  );
  lines.push('                            _used+="f:$_fl_name "');
  lines.push(
    `                        elif (( _i + 1 < _rlen )) && ${p}_can_consume "$_node" "\${_rem[_i+1]}"; then`,
  );
  lines.push('                            _used+="f:$_fl_name "');
  lines.push("                            (( _i++ ))");
  lines.push("                        elif (( _i == _rlen - 1 )); then");
  lines.push('                            _pending="$_fl_name"');
  lines.push("                        fi");
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                done");
  lines.push("                (( _i++ ))");
  lines.push("                continue");
  lines.push("            fi");
  lines.push('            if [[ "$_stop" == "first-positional" ]]; then');
  lines.push("                _stopped=1");
  lines.push('                _words+=("${_rem[@]:_i}")');
  lines.push("                break");
  lines.push("            fi");
  lines.push('            _words+=("$_tok")');
  lines.push("            (( _i++ ))");
  lines.push("        done");
  lines.push("");
  lines.push("        local _main_cnt=${#_words[@]} _dd_cnt=${#_dd_words[@]}");
  if (nodesWithConflicts.length > 0) {
    lines.push(`        ${p}_conflicts "$_node"`);
  }
  lines.push("        local _handled=0");
  lines.push('        if [[ -n "$_pending" ]]; then');
  lines.push(`            ${p}_flag_val "$_node" "$_pending"`);
  lines.push(`            ${p}_apply_flag_val "$cur"`);
  lines.push("            _handled=1");
  lines.push("        fi");
  lines.push(
    "        if (( _handled == 0 && _after_dd == 0 && _stopped == 0 )); then",
  );
  lines.push('            if [[ "$cur" == -*=* ]]; then');
  lines.push(
    '                local _lhs="${cur%%=*}" _rhs="${cur#*=}" _inline_hit=""',
  );
  lines.push('                if [[ "$_lhs" == --* ]]; then');
  lines.push(
    `                    if ${p}_flag_long "$_node" "\${_lhs:2}" && (( _fl_inline == 1 )); then`,
  );
  lines.push('                        _inline_hit="$_fl_name"');
  lines.push("                    fi");
  lines.push("                elif (( ${#_lhs} >= 2 )); then");
  lines.push("                    local _llen=${#_lhs}");
  lines.push("                    for (( _j=1; _j<_llen; _j++ )); do");
  lines.push(
    `                        if ${p}_flag_short "$_node" "\${_lhs:_j:1}" && (( _fl_inline == 1 )); then`,
  );
  lines.push(
    '                            if (( _j == _llen - 1 )); then _inline_hit="$_fl_name"; fi',
  );
  lines.push("                            break");
  lines.push("                        fi");
  lines.push("                    done");
  lines.push("                fi");
  lines.push('                if [[ -n "$_inline_hit" ]]; then');
  lines.push(`                    ${p}_flag_val "$_node" "$_inline_hit"`);
  lines.push(`                    ${p}_apply_flag_val "$_rhs"`);
  lines.push("                    _handled=1");
  lines.push("                fi");
  lines.push("            fi");
  lines.push('            if (( _handled == 0 )) && [[ "$cur" == -* ]]; then');
  lines.push(`                ${p}_emit_flags "$_node" "$cur"`);
  lines.push('                _emit_list=("${_out_items[@]}")');
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
    lines.push('            for _w in "${_words[@]}"; do');
    lines.push(
      `                if ! ${p}_transition "$_hnode" "$_w"; then _hmiss=1; break; fi`,
    );
    lines.push("                _hnode=$_next_node");
    lines.push("            done");
    lines.push("            if (( _hmiss == 0 )); then");
    lines.push(`                ${p}_subcmds "$_hnode" 0`);
    lines.push('                _emit_list=("${_sub_items[@]}")');
    lines.push(`                ${p}_filter_items "" "$cur" 0`);
    lines.push("            fi");
    lines.push(`            directive=${ShellCompDirective.NoFileComp}`);
    lines.push("            _handled=1");
    lines.push("        fi");
  }
  lines.push("        if (( _handled == 0 )); then");
  lines.push("            if (( _after_dd == 0 && _main_cnt == 0 )); then");
  lines.push("                local _inc_alias=0");
  lines.push('                [[ -n "$cur" ]] && _inc_alias=1');
  lines.push(`                ${p}_subcmds "$_node" "$_inc_alias"`);
  lines.push("            fi");
  if (disabledNodes.length > 0) {
    lines.push('            case "$_node" in');
    lines.push(`                ${disabledNodes.map((n) => n.id).join("|")})`);
    lines.push('                    _emit_list=("${_sub_items[@]}")');
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
  lines.push('                if [[ "$_val_kind" == "dynamic" ]]; then');
  lines.push("                    _use_dynamic=1");
  lines.push('                elif [[ "$_val_kind" == "none" ]]; then');
  lines.push('                    _emit_list=("${_sub_items[@]}")');
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
    '                    _emit_list=("${_sub_items[@]}" "${_val_items[@]}")',
  );
  lines.push(`                    ${p}_filter_items "" "$cur" "$_skip"`);
  lines.push("                fi");
  lines.push("            fi");
  lines.push("        fi");
  lines.push("    fi");
  lines.push("");

  if (hasDynamic) {
    lines.push("    if (( _use_dynamic == 1 )); then");
    lines.push("        local out");
    lines.push(
      `        out=$(${bin} complete -- "\${req_args[@]}" 2>/dev/null)`,
    );
    lines.push("        directive=0");
    lines.push('        if [[ "$out" == *:* ]]; then');
    lines.push(`            local _last_line="\${out##*$'\\n'}"`);
    lines.push('            if [[ "$_last_line" == :* ]]; then');
    lines.push('                directive="${_last_line#:}"');
    lines.push(`                if [[ "$out" == *$'\\n'* ]]; then`);
    lines.push(`                    out="\${out%$'\\n'*}"`);
    lines.push("                else");
    lines.push('                    out=""');
    lines.push("                fi");
    lines.push("            fi");
    lines.push("        fi");
    lines.push(`        local _tab=$'\\t' _line _val`);
    lines.push("        _result_items=()");
    lines.push("        while IFS= read -r _line; do");
    lines.push('            [[ -z "$_line" ]] && continue');
    lines.push('            _val="${_line%%$_tab*}"');
    lines.push('            _result_items+=("$_val")');
    lines.push('        done <<< "$out"');
    lines.push("    fi");
    lines.push("");
  }

  lines.push("    if (( (directive & shellCompDirectiveError) != 0 )); then");
  lines.push("        return");
  lines.push("    fi");
  lines.push("    if (( (directive & shellCompDirectiveNoSpace) != 0 )); then");
  lines.push("        compopt -o nospace 2>/dev/null");
  lines.push("    fi");
  lines.push(
    "    if (( (directive & shellCompDirectiveKeepOrder) != 0 )); then",
  );
  lines.push("        compopt -o nosort 2>/dev/null");
  lines.push("    fi");
  lines.push(
    "    if (( (directive & shellCompDirectiveNoFileComp) != 0 )); then",
  );
  lines.push("        compopt +o default 2>/dev/null");
  lines.push("    fi");
  lines.push("");
  lines.push('    local flagPrefix="" matchCur="$cur"');
  lines.push('    if [[ "$cur" == -*=* ]]; then');
  lines.push('        flagPrefix="${cur%%=*}="');
  lines.push('        matchCur="${cur#*=}"');
  lines.push("    fi");
  lines.push("");
  lines.push(
    "    if (( (directive & shellCompDirectiveFilterFileExt) != 0 )); then",
  );
  lines.push('        local filter="" ext');
  lines.push('        for ext in "${_result_items[@]}"; do');
  lines.push('            filter="${filter:+$filter|}${ext}"');
  lines.push("        done");
  lines.push("        local _had_extglob=0");
  lines.push("        shopt -q extglob && _had_extglob=1");
  lines.push("        shopt -s extglob");
  lines.push("        compopt -o filenames 2>/dev/null");
  lines.push("        local -a _files=() _dirs=()");
  lines.push(`        local _p _seen_paths=$'\\n'`);
  lines.push("        while IFS= read -r _p; do");
  lines.push('            [[ -z "$_p" ]] && continue');
  lines.push(`            _seen_paths+="$_p"$'\\n'`);
  lines.push('            _files+=("${flagPrefix}${_p}")');
  lines.push('        done < <(compgen -f -X "!*.@($filter)" -- "$matchCur")');
  lines.push("        while IFS= read -r _p; do");
  lines.push('            [[ -z "$_p" ]] && continue');
  lines.push(
    `            [[ "$_seen_paths" == *$'\\n'"$_p"$'\\n'* ]] && continue`,
  );
  lines.push('            _dirs+=("${flagPrefix}${_p}")');
  lines.push('        done < <(compgen -d -- "$matchCur")');
  lines.push("        (( _had_extglob == 0 )) && shopt -u extglob");
  lines.push('        COMPREPLY=("${_dirs[@]}" "${_files[@]}")');
  lines.push("        return");
  lines.push("    fi");
  lines.push("");
  lines.push(
    "    if (( (directive & shellCompDirectiveFilterDirs) != 0 )); then",
  );
  lines.push("        compopt -o dirnames 2>/dev/null");
  lines.push("        local _p");
  lines.push("        COMPREPLY=()");
  lines.push("        while IFS= read -r _p; do");
  lines.push('            [[ -z "$_p" ]] && continue');
  lines.push('            COMPREPLY+=("${flagPrefix}${_p}")');
  lines.push('        done < <(compgen -d -- "$matchCur")');
  lines.push("        return");
  lines.push("    fi");
  lines.push("");
  lines.push("    local value");
  lines.push("    COMPREPLY=()");
  lines.push('    for value in "${_result_items[@]}"; do');
  lines.push('        if [[ "$value" == "$matchCur"* ]]; then');
  lines.push('            COMPREPLY+=("${flagPrefix}${value}")');
  lines.push("        fi");
  lines.push("    done");
  lines.push("}");
  lines.push("");
  lines.push(`complete -o default -F ${p}_complete ${name}`);

  return lines.join("\n");
}
