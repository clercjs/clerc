/* eslint-disable no-template-curly-in-string -- Generated shell scripts use literal ${...} parameter expansion */
import { ShellCompDirective } from "../directives";
import type {
  StaticCandidate,
  StaticCompletionSpec,
  StaticNodeSpec,
  StaticValueSpec,
} from "../spec";
import { digitShortChars, shQuote, shortStartPattern } from "./utils";

const candidateExpr = (item: StaticCandidate): string =>
  item.description
    ? `${shQuote(item.value)}$'\\t'${shQuote(item.description)}`
    : shQuote(item.value);

function emitValueBody(spec: StaticValueSpec, indent: string): string[] {
  if (spec.kind === "dynamic") {
    return [`${indent}_val_kind=dynamic`];
  }
  if (spec.kind === "none") {
    return [`${indent}_val_kind=none`];
  }
  const lines = [
    `${indent}_val_kind=static`,
    `${indent}_val_dir=${spec.directive}`,
  ];
  if (spec.candidates.length > 0) {
    lines.push(
      `${indent}_val_items=(${spec.candidates.map(candidateExpr).join(" ")})`,
    );
  } else {
    lines.push(`${indent}_val_items=()`);
  }

  return lines;
}

export function emitPosixCore(
  spec: StaticCompletionSpec,
  dialect: "bash" | "zsh",
): string[] {
  const { fn, hasDynamic, nodes } = spec;
  const p = `__${fn}`;
  const isZsh = dialect === "zsh";
  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  const stopNodes = nodes.filter((n) => n.stopParsing !== "none");
  const helpNode = nodes.find((n) => n.isBuiltinHelp);
  const disabledNodes = nodes.filter((n) => n.positionalsDisabled);

  const i0 = isZsh ? 1 : 0;
  const j0 = isZsh ? 2 : 1;
  const cmp = isZsh ? "<=" : "<";
  const arrLen = (name: string): string =>
    isZsh ? `\${#${name}}` : `\${#${name}[@]}`;
  const arrAt = (name: string, idx: string): string =>
    isZsh ? `\${${name}[$${idx}]}` : `\${${name}[${idx}]}`;
  const arrNext = (name: string): string =>
    isZsh ? `\${${name}[$(( _i + 1 ))]}` : `\${${name}[_i+1]}`;
  const arrCopy = (name: string): string =>
    isZsh ? `"\${(@)${name}}"` : `"\${${name}[@]}"`;
  const arrRest = (name: string): string =>
    isZsh ? `"\${(@)${name}[$_i,-1]}"` : `"\${${name}[@]:_i}"`;
  const strFrom2 = (name: string): string =>
    isZsh ? `\${${name}[3,-1]}` : `\${${name}:2}`;
  const strAt1 = (name: string): string =>
    isZsh ? `\${${name}[2]}` : `\${${name}:1:1}`;
  const strAt = (name: string, j: string): string =>
    isZsh ? `\${${name}[$${j}]}` : `\${${name}:${j}:1}`;
  const hasMore = (idx: string, len: string): string =>
    isZsh ? `${idx} < ${len}` : `${idx} + 1 < ${len}`;
  const isLast = (idx: string, len: string): string =>
    isZsh ? `${idx} == ${len}` : `${idx} == ${len} - 1`;

  const lines: string[] = [];

  lines.push(
    '    local _node=0 _next_node="" _fl_name="" _fl_takes=0 _fl_inline=0',
  );
  lines.push(
    `    local _matched_set=" " _plen=${arrLen("prior")} _i=${i0} _tok _tlen _rest _has_eq _fname _j _ch`,
  );
  lines.push(`    while (( _i ${cmp} _plen )); do`);
  lines.push(`        _tok="${arrAt("prior", "_i")}"`);
  lines.push("        _tlen=${#_tok}");
  lines.push('        if [[ "$_tok" == "--" ]]; then');
  lines.push("            break");
  lines.push('        elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then');
  lines.push(`            _rest="${strFrom2("_tok")}"`);
  lines.push("            _has_eq=0");
  lines.push('            _fname="$_rest"');
  lines.push('            if [[ "$_rest" == *=* ]]; then');
  lines.push("                _has_eq=1");
  lines.push('                _fname="${_rest%%=*}"');
  lines.push("            fi");
  lines.push(`            ${p}_flag_long "$_node" "$_fname" || break`);
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _has_eq == 0 && _fl_takes == 1 && _i ${cmp} _plen )) && ${p}_can_consume "$_node" "${arrAt("prior", "_i")}"; then`,
  );
  lines.push("                (( _i++ ))");
  lines.push("            fi");
  lines.push("            continue");
  lines.push(
    `        elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "${strAt1("_tok")}"; then`,
  );
  lines.push("            local _takes_next=0 _bad_short=0");
  lines.push(`            for (( _j=${j0}; _j ${cmp} _tlen; _j++ )); do`);
  lines.push(`                _ch="${strAt("_tok", "_j")}"`);
  lines.push(`                if ! ${p}_flag_short "$_node" "$_ch"; then`);
  lines.push("                    _bad_short=1; break");
  lines.push("                fi");
  lines.push("                if (( _fl_inline == 1 )); then");
  lines.push(
    `                    if (( ${isLast("_j", "_tlen")} && _fl_takes == 1 )); then _takes_next=1; fi`,
  );
  lines.push("                    break");
  lines.push("                fi");
  lines.push("            done");
  lines.push("            (( _bad_short == 1 )) && break");
  lines.push("            (( _i++ ))");
  lines.push(
    `            if (( _takes_next == 1 && _i ${cmp} _plen )) && ${p}_can_consume "$_node" "${arrAt("prior", "_i")}"; then`,
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
  lines.push(`        _rem=(${arrCopy("prior")})`);
  lines.push("    else");
  lines.push(`        for (( _i=${i0}; _i ${cmp} _plen; _i++ )); do`);
  lines.push('            if [[ "$_matched_set" != *" $_i "* ]]; then');
  lines.push(`                _rem+=("${arrAt("prior", "_i")}")`);
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
    "    local _use_dynamic=0",
    `    directive=${ShellCompDirective.NoFileComp}`,
    "    local -a _result_items=() _emit_list=() _val_items=() _sub_items=() _out_items=()",
    `    local _val_kind=none _val_delim="" _val_dir=${ShellCompDirective.NoFileComp}`,
    "",
  );
  if (hasDynamic) {
    lines.push(
      `    if [[ "$_stop" == "dynamic" ]] && (( ${arrLen("_rem")} > 0 )); then`,
      "        _use_dynamic=1",
      "    fi",
    );
  }
  lines.push("    if (( _use_dynamic == 0 )); then");
  lines.push(
    '        local _used=" " _conf=" " _after_dd=0 _stopped=0 _pending=""',
  );
  lines.push("        local -a _words=() _dd_words=()");
  lines.push(`        local _rlen=${arrLen("_rem")}`);
  lines.push(`        _i=${i0}`);
  lines.push(`        while (( _i ${cmp} _rlen )); do`);
  lines.push(`            _tok="${arrAt("_rem", "_i")}"`);
  lines.push("            _tlen=${#_tok}");
  lines.push('            if [[ "$_tok" == "--" ]]; then');
  lines.push("                _after_dd=1");
  if (isZsh) {
    lines.push("                if (( _i < _rlen )); then");
    lines.push(
      '                    _dd_words=("${(@)_rem[$(( _i + 1 )),-1]}")',
    );
    lines.push("                fi");
  } else {
    lines.push('                _dd_words=("${_rem[@]:_i+1}")');
  }
  lines.push("                break");
  lines.push('            elif (( _tlen > 2 )) && [[ "$_tok" == --* ]]; then');
  lines.push(`                _rest="${strFrom2("_tok")}"`);
  lines.push("                _has_eq=0");
  lines.push('                _fname="$_rest"');
  lines.push('                if [[ "$_rest" == *=* ]]; then');
  lines.push("                    _has_eq=1");
  lines.push('                    _fname="${_rest%%=*}"');
  lines.push("                fi");
  lines.push(`                if ! ${p}_flag_long "$_node" "$_fname"; then`);
  lines.push('                    if [[ "$_stop" == "unknown-flag" ]]; then');
  lines.push("                        _stopped=1");
  lines.push(`                        _words+=(${arrRest("_rem")})`);
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
    `                    elif (( ${hasMore("_i", "_rlen")} )) && ${p}_can_consume "$_node" "${arrNext("_rem")}"; then`,
  );
  lines.push('                        _used+="f:$_fl_name "');
  lines.push("                        (( _i++ ))");
  lines.push(`                    elif (( ${isLast("_i", "_rlen")} )); then`);
  lines.push('                        _pending="$_fl_name"');
  lines.push("                    fi");
  lines.push("                else");
  lines.push('                    _used+="f:$_fl_name "');
  lines.push("                fi");
  lines.push("                (( _i++ ))");
  lines.push("                continue");
  lines.push(
    `            elif (( _tlen >= 2 )) && [[ "$_tok" == -* ]] && ${p}_is_short_start "$_node" "${strAt1("_tok")}"; then`,
  );
  lines.push('                if [[ "$_stop" == "unknown-flag" ]]; then');
  lines.push("                    local _all_known=1");
  lines.push(
    `                    for (( _j=${j0}; _j ${cmp} _tlen; _j++ )); do`,
  );
  lines.push(`                        _ch="${strAt("_tok", "_j")}"`);
  lines.push(
    `                        if ! ${p}_flag_short "$_node" "$_ch"; then _all_known=0; break; fi`,
  );
  lines.push(
    "                        if (( _fl_inline == 1 )); then break; fi",
  );
  lines.push("                    done");
  lines.push("                    if (( _all_known == 0 )); then");
  lines.push("                        _stopped=1");
  lines.push(`                        _words+=(${arrRest("_rem")})`);
  lines.push("                        break");
  lines.push("                    fi");
  lines.push("                fi");
  lines.push(`                for (( _j=${j0}; _j ${cmp} _tlen; _j++ )); do`);
  lines.push(`                    _ch="${strAt("_tok", "_j")}"`);
  lines.push(`                    ${p}_flag_short "$_node" "$_ch" || continue`);
  lines.push("                    if (( _fl_inline == 0 )); then");
  lines.push('                        _used+="f:$_fl_name "');
  lines.push("                    else");
  lines.push(
    `                        if (( ${hasMore("_j", "_tlen")} || _fl_takes == 0 )); then`,
  );
  lines.push('                            _used+="f:$_fl_name "');
  lines.push(
    `                        elif (( ${hasMore("_i", "_rlen")} )) && ${p}_can_consume "$_node" "${arrNext("_rem")}"; then`,
  );
  lines.push('                            _used+="f:$_fl_name "');
  lines.push("                            (( _i++ ))");
  lines.push(
    `                        elif (( ${isLast("_i", "_rlen")} )); then`,
  );
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
  lines.push(`                _words+=(${arrRest("_rem")})`);
  lines.push("                break");
  lines.push("            fi");
  lines.push('            _words+=("$_tok")');
  lines.push("            (( _i++ ))");
  lines.push("        done");
  lines.push("");
  lines.push(
    `        local _main_cnt=${arrLen("_words")} _dd_cnt=${arrLen("_dd_words")}`,
  );
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
    `                    if ${p}_flag_long "$_node" "${strFrom2("_lhs")}" && (( _fl_inline == 1 )); then`,
  );
  lines.push('                        _inline_hit="$_fl_name"');
  lines.push("                    fi");
  lines.push("                elif (( ${#_lhs} >= 2 )); then");
  lines.push("                    local _llen=${#_lhs}");
  lines.push(
    `                    for (( _j=${j0}; _j ${cmp} _llen; _j++ )); do`,
  );
  lines.push(
    `                        if ${p}_flag_short "$_node" "${strAt("_lhs", "_j")}" && (( _fl_inline == 1 )); then`,
  );
  lines.push(
    `                            if (( ${isLast("_j", "_llen")} )); then _inline_hit="$_fl_name"; fi`,
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

  return lines;
}

export function emitPosixHelpers(
  spec: StaticCompletionSpec,
  keepDescriptions: boolean,
): string[] {
  const { fn, nodes } = spec;
  const p = `__${fn}`;
  const lines: string[] = [];

  lines.push(`${p}_transition() {`);
  lines.push(`    _next_node=""`);
  lines.push(`    case "$1:$2" in`);
  for (const node of nodes) {
    for (const tr of node.transitions) {
      lines.push(
        `        ${shQuote(`${node.id}:${tr.token}`)}) _next_node=${tr.targetId}; return 0 ;;`,
      );
    }
  }
  lines.push("    esac");
  lines.push("    return 1");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_flag_long() {`);
  lines.push(`    case "$1:$2" in`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      const patterns = flag.longParseNames
        .map((n) => shQuote(`${node.id}:${n}`))
        .join("|");
      lines.push(
        `        ${patterns}) _fl_name=${shQuote(flag.name)}; _fl_takes=${flag.takesValue ? 1 : 0}; _fl_inline=${flag.acceptsInlineValue ? 1 : 0}; return 0 ;;`,
      );
    }
  }
  lines.push("    esac");
  lines.push("    return 1");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_flag_short() {`);
  lines.push(`    case "$1:$2" in`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (!flag.short) {
        continue;
      }
      lines.push(
        `        ${shQuote(`${node.id}:${flag.short}`)}) _fl_name=${shQuote(flag.name)}; _fl_takes=${flag.takesValue ? 1 : 0}; _fl_inline=${flag.acceptsInlineValue ? 1 : 0}; return 0 ;;`,
      );
    }
  }
  lines.push("    esac");
  lines.push("    return 1");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_flag_val() {`);
  lines.push("    _val_kind=none");
  lines.push(`    _val_delim=""`);
  lines.push(`    _val_dir=${ShellCompDirective.NoFileComp}`);
  lines.push("    _val_items=()");
  lines.push(`    case "$1:$2" in`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (flag.value.kind === "none") {
        continue;
      }
      lines.push(`        ${shQuote(`${node.id}:${flag.name}`)})`);
      if (flag.delimiter) {
        lines.push(`            _val_delim=${shQuote(flag.delimiter)}`);
      }
      lines.push(...emitValueBody(flag.value, "            "));
      lines.push("            ;;");
    }
  }
  lines.push("    esac");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_subcmds() {`);
  lines.push("    _sub_items=()");
  lines.push(`    case "$1" in`);
  for (const node of nodes) {
    if (
      node.visibleSubcommands.length === 0 &&
      node.visibleAliases.length === 0
    ) {
      continue;
    }
    lines.push(`        ${node.id})`);
    if (node.visibleSubcommands.length > 0) {
      lines.push(
        `            _sub_items=(${node.visibleSubcommands.map(candidateExpr).join(" ")})`,
      );
    }
    if (node.visibleAliases.length > 0) {
      lines.push(
        `            if [[ "$2" == "1" ]]; then`,
        `                _sub_items+=(${node.visibleAliases.map(candidateExpr).join(" ")})`,
        "            fi",
      );
    }
    lines.push("            ;;");
  }
  lines.push("    esac");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_emit_flags() {`);
  lines.push(
    `    local _nid="$1" _cur="$2" _is_dd=0 _is_short_only=0 _show_neg=0`,
  );
  lines.push(`    if [[ "$_cur" == --* ]]; then`);
  lines.push("        _is_dd=1");
  lines.push("    elif (( \${#_cur} > 1 )); then");
  lines.push("        _is_short_only=1");
  lines.push("    fi");
  lines.push(`    if [[ "$_cur" == --no* ]]; then`);
  lines.push("        _show_neg=1");
  lines.push("    fi");
  lines.push("    _out_items=()");
  lines.push(`    case "$_nid" in`);
  for (const node of nodes) {
    const completable = node.flags.filter((f) => f.completable);
    if (completable.length === 0) {
      continue;
    }
    lines.push(`        ${node.id})`);
    for (const flag of completable) {
      const pat = `f:${flag.name}`;
      const conds: string[] = [];
      if (!flag.repeatable) {
        conds.push(`[[ "$_used" != *" ${pat} "* ]]`);
      }
      conds.push(`[[ "$_conf" != *" ${pat} "* ]]`);
      lines.push(`            if ${conds.join(" && ")}; then`);
      const longItems: string[] = [
        candidateExpr({ value: flag.target, description: flag.description }),
        ...flag.aliases.map((alias) =>
          candidateExpr({
            value: `--${alias}`,
            description: flag.description,
          }),
        ),
      ];
      const negExpr = flag.negatable
        ? candidateExpr({
            value: `--no-${flag.target.slice(2)}`,
            description: flag.description,
          })
        : undefined;
      if (negExpr && flag.defaultTrue) {
        longItems.push(negExpr);
      }
      lines.push("                if (( _is_short_only == 0 )); then");
      lines.push(`                    _out_items+=(${longItems.join(" ")})`);
      if (negExpr && !flag.defaultTrue) {
        lines.push("                    if (( _show_neg == 1 )); then");
        lines.push(`                        _out_items+=(${negExpr})`);
        lines.push("                    fi");
      }
      lines.push("                fi");
      if (flag.short) {
        const shortExpr = candidateExpr({
          value: `-${flag.short}`,
          description: flag.description,
        });
        lines.push("                if (( _is_dd == 0 )); then");
        lines.push(`                    _out_items+=(${shortExpr})`);
        lines.push("                fi");
      }
      lines.push("            fi");
    }
    lines.push("            ;;");
  }
  lines.push("    esac");
  lines.push("}");
  lines.push("");

  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  if (nodesWithConflicts.length > 0) {
    lines.push(`${p}_conflicts() {`);
    lines.push(`    local _all_used="$_used" _k`);
    lines.push(
      `    for (( _k=0; _k<_main_cnt; _k++ )); do _all_used+="m:$_k "; done`,
    );
    lines.push(
      `    for (( _k=0; _k<_dd_cnt; _k++ )); do _all_used+="d:$_k "; done`,
    );
    lines.push(`    case "$1" in`);
    for (const node of nodesWithConflicts) {
      lines.push(`        ${node.id})`);
      for (const group of node.conflictGroups) {
        const members = group.map(shQuote).join(" ");
        lines.push(
          "            local _hit=0 _m",
          `            for _m in ${members}; do`,
          `                if [[ "$_all_used" == *" $_m "* ]]; then _hit=1; break; fi`,
          "            done",
          "            if (( _hit == 1 )); then",
          `                for _m in ${members}; do`,
          `                    if [[ "$_all_used" != *" $_m "* ]]; then _conf+="$_m "; fi`,
          "                done",
          "            fi",
        );
      }
      lines.push("            ;;");
    }
    lines.push("    esac");
    lines.push("}");
    lines.push("");
  }

  lines.push(`${p}_pos_val() {`);
  lines.push("    _val_kind=none");
  lines.push(`    _val_dir=${ShellCompDirective.NoFileComp}`);
  lines.push("    _val_items=()");
  lines.push(`    case "$1" in`);
  for (const node of nodes) {
    if (node.isBuiltinHelp || node.positionalsDisabled) {
      continue;
    }
    const hasMain = node.mainArgs.some((a) => a.value.kind !== "none");
    const hasDd = node.ddArgs.some((a) => a.value.kind !== "none");
    const hasOverflow = node.overflowValue.kind !== "none";
    if (!hasMain && !hasDd && !hasOverflow) {
      continue;
    }
    lines.push(`        ${node.id})`);
    function emitSlice(
      slice: StaticNodeSpec["mainArgs"],
      prefix: "m" | "d",
      idxExpr: string,
      indent: string,
    ): string[] {
      const out: string[] = [];
      if (slice.length === 0) {
        out.push(...emitValueBody(node.overflowValue, indent));

        return out;
      }
      const last = slice.at(-1)!;
      out.push(`${indent}local _aidx=$(( ${idxExpr} ))`);
      if (last.isVariadic) {
        out.push(
          `${indent}if (( _aidx >= ${slice.length} )); then _aidx=${slice.length - 1}; fi`,
        );
      }
      out.push(
        `${indent}if [[ "$_conf" == *" ${prefix}:$_aidx "* ]]; then return; fi`,
      );
      out.push(`${indent}case "$_aidx" in`);
      for (const [idx, arg] of slice.entries()) {
        out.push(`${indent}    ${idx})`);
        out.push(...emitValueBody(arg.value, `${indent}        `));
        out.push(`${indent}        ;;`);
      }
      if (!last.isVariadic && node.overflowValue.kind !== "none") {
        out.push(`${indent}    *)`);
        out.push(...emitValueBody(node.overflowValue, `${indent}        `));
        out.push(`${indent}        ;;`);
      }
      out.push(`${indent}esac`);

      return out;
    }

    lines.push("            if (( _after_dd == 1 )); then");
    if (node.ddArgs.length > 0) {
      lines.push(...emitSlice(node.ddArgs, "d", "_dd_cnt", "                "));
    } else if (node.hasDoubleDashToken) {
      lines.push(...emitValueBody(node.overflowValue, "                "));
    } else {
      lines.push(
        ...emitSlice(
          node.mainArgs,
          "m",
          "_main_cnt + _dd_cnt",
          "                ",
        ),
      );
    }
    lines.push("            else");
    lines.push(
      ...emitSlice(node.mainArgs, "m", "_main_cnt", "                "),
    );
    lines.push("            fi");
    lines.push("            ;;");
  }
  lines.push("    esac");
  lines.push("}");
  lines.push("");

  const digitNodes = nodes.filter((n) => n.hasDigitShort);

  lines.push(`${p}_can_consume() {`);
  if (digitNodes.length > 0) {
    lines.push(`    local _re='^(--|-[A-Za-z])'`);
    lines.push(`    case "$1" in`);
    for (const node of digitNodes) {
      lines.push(
        `        ${node.id}) _re=${shQuote(shortStartPattern(node))} ;;`,
      );
    }
    lines.push("    esac");
    lines.push(`    [[ ! "$2" =~ $_re ]]`);
  } else {
    lines.push(`    local _re='^(--|-[A-Za-z])'`);
    lines.push(`    [[ ! "$2" =~ $_re ]]`);
  }
  lines.push("}");
  lines.push("");

  lines.push(`${p}_is_short_start() {`);
  if (digitNodes.length > 0) {
    lines.push(`    local _re='^[A-Za-z]'`);
    lines.push(`    case "$1" in`);
    for (const node of digitNodes) {
      lines.push(
        `        ${node.id}) _re=${shQuote(`^[A-Za-z${digitShortChars(node)}]`)} ;;`,
      );
    }
    lines.push("    esac");
    lines.push(`    [[ "$2" =~ $_re ]]`);
  } else {
    lines.push(`    local _re='^[A-Za-z]'`);
    lines.push(`    [[ "$2" =~ $_re ]]`);
  }
  lines.push("}");
  lines.push("");

  const outElem = keepDescriptions
    ? "\${_prefix}\${_item}"
    : "\${_prefix}\${_val}";
  lines.push(`${p}_filter_items() {`);
  lines.push(
    `    local _prefix="$1" _cur="$2" _skip="$3" _tab=$'\\t' _seen=$'\\n' _item _val`,
  );
  lines.push("    _result_items=()");
  lines.push(`    for _item in "\${_emit_list[@]}"; do`);
  lines.push(`        _val="\${_item%%$_tab*}"`);
  lines.push("        if (( _skip == 0 )); then");
  lines.push(`            [[ "$_val" == "$_cur"* ]] || continue`);
  lines.push(`            [[ "$_seen" == *$'\\n'"$_val"$'\\n'* ]] && continue`);
  lines.push(`            _seen+="$_val"$'\\n'`);
  lines.push("        fi");
  lines.push(`        _result_items+=("${outElem}")`);
  lines.push("    done");
  lines.push("}");
  lines.push("");

  lines.push(`${p}_apply_flag_val() {`);
  lines.push(`    local _vcur="$1"`);
  lines.push(`    if [[ "$_val_kind" == "dynamic" ]]; then`);
  lines.push("        _use_dynamic=1");
  lines.push("        return");
  lines.push("    fi");
  lines.push(`    if [[ "$_val_kind" == "none" ]]; then`);
  lines.push(`        directive=${ShellCompDirective.NoFileComp}`);
  lines.push("        _result_items=()");
  lines.push("        return");
  lines.push("    fi");
  lines.push("    directive=$_val_dir");
  lines.push("    local _skip=0");
  lines.push(
    `    if (( (directive & (${ShellCompDirective.FilterFileExt} | ${ShellCompDirective.FilterDirs})) != 0 )); then`,
  );
  lines.push("        _skip=1");
  lines.push("    fi");
  lines.push(
    `    if [[ -n "$_val_delim" && "$_vcur" == *"$_val_delim"* ]]; then`,
  );
  lines.push(`        local _icur="\${_vcur##*"$_val_delim"}"`);
  lines.push(`        local _before="\${_vcur%"$_val_delim$_icur"}"`);
  lines.push(`        local _head="\${_before}\${_val_delim}"`);
  lines.push(`        local _picked="\${_val_delim}\${_before}\${_val_delim}"`);
  lines.push(`        local _tab=$'\\t' _item _v`);
  lines.push("        _emit_list=()");
  lines.push(`        for _item in "\${_val_items[@]}"; do`);
  lines.push(`            _v="\${_item%%$_tab*}"`);
  lines.push(
    `            [[ "$_picked" == *"$_val_delim$_v$_val_delim"* ]] && continue`,
  );
  lines.push(`            _emit_list+=("$_item")`);
  lines.push("        done");
  lines.push(`        ${p}_filter_items "$_head" "$_icur" "$_skip"`);
  lines.push("    else");
  lines.push(`        _emit_list=("\${_val_items[@]}")`);
  lines.push(`        ${p}_filter_items "" "$_vcur" "$_skip"`);
  lines.push("    fi");
  lines.push("}");
  lines.push("");

  return lines;
}
