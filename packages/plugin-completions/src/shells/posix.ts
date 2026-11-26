/* eslint-disable no-template-curly-in-string -- Generated shell scripts use literal ${...} parameter expansion */
import { ShellCompDirective } from "../directives";
import type {
  StaticCandidate,
  StaticCompletionSpec,
  StaticNodeSpec,
  StaticValueSpec,
} from "../spec";
import { shQuote } from "./utils";

const candidateExpr = (item: StaticCandidate): string =>
  item.description
    ? `${shQuote(item.value)}$'\\t'${shQuote(item.description)}`
    : shQuote(item.value);

function shortStartRegex(node: StaticNodeSpec): string {
  const digits = node.flags
    .map((f) => f.short)
    .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
    .join("");

  return digits ? `^(--|-[A-Za-z${digits}])` : "^(--|-[A-Za-z])";
}

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
        `        ${node.id}) _re=${shQuote(shortStartRegex(node))} ;;`,
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
      const digits = node.flags
        .map((f) => f.short)
        .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
        .join("");
      lines.push(`        ${node.id}) _re=${shQuote(`^[A-Za-z${digits}]`)} ;;`);
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
