import { ShellCompDirective } from "../directives";
import type {
  StaticCandidate,
  StaticCompletionSpec,
  StaticNodeSpec,
  StaticValueSpec,
} from "../spec";
import { fishQuote } from "./utils";

const fishCandidateExpr = (item: StaticCandidate): string =>
  item.description
    ? `${fishQuote(item.value)}$_tab${fishQuote(item.description)}`
    : fishQuote(item.value);

function fishShortStartRegex(node: StaticNodeSpec): string {
  const digits = node.flags
    .map((f) => f.short)
    .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
    .join("");

  return digits ? `^(--|-[A-Za-z${digits}])` : "^(--|-[A-Za-z])";
}

function emitValueBody(spec: StaticValueSpec, indent: string): string[] {
  if (spec.kind === "dynamic") {
    return [`${indent}set _val_kind dynamic`];
  }
  if (spec.kind === "none") {
    return [`${indent}set _val_kind none`];
  }
  const lines = [
    `${indent}set _val_kind static`,
    `${indent}set _val_dir ${spec.directive}`,
  ];
  if (spec.candidates.length > 0) {
    lines.push(
      `${indent}set _val_items ${spec.candidates.map(fishCandidateExpr).join(" ")}`,
    );
  } else {
    lines.push(`${indent}set _val_items`);
  }

  return lines;
}

export function renderFishScript(spec: StaticCompletionSpec): string {
  const { name, bin, fn, hasDynamic, nodes } = spec;
  const p = `__${fn}`;
  const lines: string[] = [];

  lines.push(`# fish completion for ${name} -*- shell-script -*-`);
  lines.push("");

  // 1. Subcommand transitions
  lines.push(`function ${p}_transition --no-scope-shadowing`);
  lines.push(`    set _next_node ""`);
  lines.push(`    switch "$argv[1]:$argv[2]"`);
  for (const node of nodes) {
    for (const tr of node.transitions) {
      lines.push(
        `        case ${fishQuote(`${node.id}:${tr.token}`)}`,
        `            set _next_node ${tr.targetId}`,
        "            return 0",
      );
    }
  }
  lines.push("    end");
  lines.push("    return 1");
  lines.push("end");
  lines.push("");

  // 2. Long flag lookup
  lines.push(`function ${p}_flag_long --no-scope-shadowing`);
  lines.push(`    switch "$argv[1]:$argv[2]"`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      const patterns = flag.longParseNames
        .map((n) => fishQuote(`${node.id}:${n}`))
        .join(" ");
      lines.push(
        `        case ${patterns}`,
        `            set _fl_name ${fishQuote(flag.name)}`,
        `            set _fl_takes ${flag.takesValue ? 1 : 0}`,
        `            set _fl_inline ${flag.acceptsInlineValue ? 1 : 0}`,
        "            return 0",
      );
    }
  }
  lines.push("    end");
  lines.push("    return 1");
  lines.push("end");
  lines.push("");

  // 3. Short flag lookup
  lines.push(`function ${p}_flag_short --no-scope-shadowing`);
  lines.push(`    switch "$argv[1]:$argv[2]"`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (!flag.short) {
        continue;
      }
      lines.push(
        `        case ${fishQuote(`${node.id}:${flag.short}`)}`,
        `            set _fl_name ${fishQuote(flag.name)}`,
        `            set _fl_takes ${flag.takesValue ? 1 : 0}`,
        `            set _fl_inline ${flag.acceptsInlineValue ? 1 : 0}`,
        "            return 0",
      );
    }
  }
  lines.push("    end");
  lines.push("    return 1");
  lines.push("end");
  lines.push("");

  // 4. Flag value completion spec
  lines.push(`function ${p}_flag_val --no-scope-shadowing`);
  lines.push("    set _val_kind none");
  lines.push(`    set _val_delim ""`);
  lines.push(`    set _val_dir ${ShellCompDirective.NoFileComp}`);
  lines.push("    set _val_items");
  lines.push(`    switch "$argv[1]:$argv[2]"`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (flag.value.kind === "none") {
        continue;
      }
      lines.push(`        case ${fishQuote(`${node.id}:${flag.name}`)}`);
      if (flag.delimiter) {
        lines.push(`            set _val_delim ${fishQuote(flag.delimiter)}`);
      }
      lines.push(...emitValueBody(flag.value, "            "));
    }
  }
  lines.push("    end");
  lines.push("end");
  lines.push("");

  // 5. Visible subcommands & aliases
  lines.push(`function ${p}_subcmds --no-scope-shadowing`);
  lines.push("    set _sub_items");
  lines.push(`    switch "$argv[1]"`);
  for (const node of nodes) {
    if (
      node.visibleSubcommands.length === 0 &&
      node.visibleAliases.length === 0
    ) {
      continue;
    }
    lines.push(`        case ${node.id}`);
    if (node.visibleSubcommands.length > 0) {
      lines.push(
        `            set _sub_items ${node.visibleSubcommands.map(fishCandidateExpr).join(" ")}`,
      );
    }
    if (node.visibleAliases.length > 0) {
      lines.push(
        `            if test "$argv[2]" = 1`,
        `                set -a _sub_items ${node.visibleAliases.map(fishCandidateExpr).join(" ")}`,
        "            end",
      );
    }
  }
  lines.push("    end");
  lines.push("end");
  lines.push("");

  // 6. Flag name candidates for a node
  lines.push(`function ${p}_emit_flags --no-scope-shadowing`);
  lines.push(`    set -l _nid "$argv[1]"`);
  lines.push(`    set -l _cur "$argv[2]"`);
  lines.push("    set -l _is_dd 0");
  lines.push("    set -l _is_short_only 0");
  lines.push("    set -l _show_neg 0");
  lines.push(`    if string match -q -- "--*" "$_cur"`);
  lines.push("        set _is_dd 1");
  lines.push(`    else if test (string length -- "$_cur") -gt 1`);
  lines.push("        set _is_short_only 1");
  lines.push("    end");
  lines.push(`    if string match -q -- "--no*" "$_cur"`);
  lines.push("        set _show_neg 1");
  lines.push("    end");
  lines.push("    set -l _raw");
  lines.push(`    switch "$_nid"`);
  for (const node of nodes) {
    const completable = node.flags.filter((f) => f.completable);
    if (completable.length === 0) {
      continue;
    }
    lines.push(`        case ${node.id}`);
    for (const flag of completable) {
      const tokenId = fishQuote(`f:${flag.name}`);
      const guards: string[] = [];
      if (!flag.repeatable) {
        guards.push(`not contains -- ${tokenId} $_used`);
      }
      guards.push(`not contains -- ${tokenId} $_conf`);
      lines.push(`            if ${guards.join("; and ")}`);
      const longItems: string[] = [
        fishCandidateExpr({
          value: flag.target,
          description: flag.description,
        }),
        ...flag.aliases.map((alias) =>
          fishCandidateExpr({
            value: `--${alias}`,
            description: flag.description,
          }),
        ),
      ];
      const negExpr = flag.negatable
        ? fishCandidateExpr({
            value: `--no-${flag.target.slice(2)}`,
            description: flag.description,
          })
        : undefined;
      if (negExpr && flag.defaultTrue) {
        longItems.push(negExpr);
      }
      lines.push("                if test $_is_short_only -eq 0");
      lines.push(`                    set -a _raw ${longItems.join(" ")}`);
      if (negExpr && !flag.defaultTrue) {
        lines.push("                    if test $_show_neg -eq 1");
        lines.push(`                        set -a _raw ${negExpr}`);
        lines.push("                    end");
      }
      lines.push("                end");
      if (flag.short) {
        const shortExpr = fishCandidateExpr({
          value: `-${flag.short}`,
          description: flag.description,
        });
        lines.push("                if test $_is_dd -eq 0");
        lines.push(`                    set -a _raw ${shortExpr}`);
        lines.push("                end");
      }
      lines.push("            end");
    }
  }
  lines.push("    end");
  lines.push("    set _out_items $_raw");
  lines.push("end");
  lines.push("");

  // 7. Rule conflicts (exclusive / oneOf)
  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  if (nodesWithConflicts.length > 0) {
    lines.push(`function ${p}_conflicts --no-scope-shadowing`);
    lines.push("    set -l _all_used $_used");
    lines.push("    if test $_main_cnt -gt 0");
    lines.push("        for _k in (seq 0 (math $_main_cnt - 1))");
    lines.push(`            set -a _all_used "m:$_k"`);
    lines.push("        end");
    lines.push("    end");
    lines.push("    if test $_dd_cnt -gt 0");
    lines.push("        for _k in (seq 0 (math $_dd_cnt - 1))");
    lines.push(`            set -a _all_used "d:$_k"`);
    lines.push("        end");
    lines.push("    end");
    lines.push(`    switch "$argv[1]"`);
    for (const node of nodesWithConflicts) {
      lines.push(`        case ${node.id}`);
      for (const group of node.conflictGroups) {
        const members = group.map(fishQuote).join(" ");
        lines.push(
          `            set -l _grp ${members}`,
          "            set -l _hit 0",
          "            for _m in $_grp",
          `                if contains -- "$_m" $_all_used`,
          "                    set _hit 1",
          "                    break",
          "                end",
          "            end",
          "            if test $_hit -eq 1",
          "                for _m in $_grp",
          `                    if not contains -- "$_m" $_all_used`,
          `                        set -a _conf "$_m"`,
          "                    end",
          "                end",
          "            end",
        );
      }
    }
    lines.push("    end");
    lines.push("end");
    lines.push("");
  }

  // 8. Positional value spec
  lines.push(`function ${p}_pos_val --no-scope-shadowing`);
  lines.push("    set _val_kind none");
  lines.push(`    set _val_dir ${ShellCompDirective.NoFileComp}`);
  lines.push("    set _val_items");
  lines.push(`    switch "$argv[1]"`);
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
    lines.push(`        case ${node.id}`);
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
      out.push(`${indent}set -l _aidx ${idxExpr}`);
      if (last.isVariadic) {
        out.push(
          `${indent}if test $_aidx -ge ${slice.length}`,
          `${indent}    set _aidx ${slice.length - 1}`,
          `${indent}end`,
        );
      }
      out.push(`${indent}if contains -- "${prefix}:$_aidx" $_conf`);
      out.push(`${indent}    return`);
      out.push(`${indent}end`);
      out.push(`${indent}switch "$_aidx"`);
      for (const [idx, arg] of slice.entries()) {
        if (arg.value.kind === "none") {
          out.push(
            `${indent}    case ${idx}`,
            `${indent}        set _val_kind none`,
          );
        } else {
          out.push(
            `${indent}    case ${idx}`,
            ...emitValueBody(arg.value, `${indent}        `),
          );
        }
      }
      if (!last.isVariadic && node.overflowValue.kind !== "none") {
        out.push(
          `${indent}    case '*'`,
          ...emitValueBody(node.overflowValue, `${indent}        `),
        );
      }
      out.push(`${indent}end`);

      return out;
    }

    lines.push("            if test $_after_dd -eq 1");
    if (node.ddArgs.length > 0) {
      lines.push(
        ...emitSlice(node.ddArgs, "d", "$_dd_cnt", "                "),
      );
    } else if (node.hasDoubleDashToken) {
      lines.push(...emitValueBody(node.overflowValue, "                "));
    } else {
      lines.push(
        ...emitSlice(
          node.mainArgs,
          "m",
          "(math $_main_cnt + $_dd_cnt)",
          "                ",
        ),
      );
    }
    lines.push("            else");
    lines.push(
      ...emitSlice(node.mainArgs, "m", "$_main_cnt", "                "),
    );
    lines.push("            end");
  }
  lines.push("    end");
  lines.push("end");
  lines.push("");

  // 9. Node metadata helpers
  const digitNodes = nodes.filter((n) => n.hasDigitShort);
  const stopNodes = nodes.filter((n) => n.stopParsing !== "none");
  const helpNode = nodes.find((n) => n.isBuiltinHelp);
  const disabledNodes = nodes.filter((n) => n.positionalsDisabled);

  lines.push(`function ${p}_can_consume --no-scope-shadowing`);
  if (digitNodes.length > 0) {
    lines.push(`    set -l _re '^(--|-[A-Za-z])'`);
    lines.push(`    switch "$argv[1]"`);
    for (const node of digitNodes) {
      lines.push(
        `        case ${node.id}`,
        `            set _re ${fishQuote(fishShortStartRegex(node))}`,
      );
    }
    lines.push("    end");
    lines.push(`    not string match -qr -- "$_re" "$argv[2]"`);
  } else {
    lines.push(`    not string match -qr -- '^(--|-[A-Za-z])' "$argv[2]"`);
  }
  lines.push("end");
  lines.push("");

  lines.push(`function ${p}_is_short_start --no-scope-shadowing`);
  if (digitNodes.length > 0) {
    lines.push(`    set -l _re '^[A-Za-z]'`);
    lines.push(`    switch "$argv[1]"`);
    for (const node of digitNodes) {
      const digits = node.flags
        .map((f) => f.short)
        .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
        .join("");
      lines.push(
        `        case ${node.id}`,
        `            set _re ${fishQuote(`^[A-Za-z${digits}]`)}`,
      );
    }
    lines.push("    end");
    lines.push(`    string match -qr -- "$_re" "$argv[2]"`);
  } else {
    lines.push(`    string match -qr -- '^[A-Za-z]' "$argv[2]"`);
  }
  lines.push("end");
  lines.push("");

  // Dynamic fallback helper (only emitted if CLI has any dynamic completion)
  if (hasDynamic) {
    lines.push(`function ${p}_dynamic`);
    lines.push("    set -l args (commandline -opc)");
    lines.push("    set -l lastArg (commandline -ct)");
    lines.push(
      `    set -l results (${bin} complete -- $args[2..-1] "$lastArg" 2> /dev/null)`,
    );
    lines.push("    for line in $results[-1..1]");
    lines.push(`        if test (string trim -- $line) = ""`);
    lines.push("            set results $results[1..-2]");
    lines.push("        else");
    lines.push("            break");
    lines.push("        end");
    lines.push("    end");
    lines.push("    set -l comps $results[1..-2]");
    lines.push("    set -l directiveLine $results[-1]");
    lines.push(`    set -l flagPrefix (string match -r -- '-.*=' "$lastArg")`);
    lines.push("    for comp in $comps");
    lines.push(`        printf "%s%s\\n" "$flagPrefix" "$comp"`);
    lines.push("    end");
    lines.push(`    printf "%s\\n" "$directiveLine"`);
    lines.push("end");
    lines.push("");
  }

  // Helper: filter, dedupe and print candidates with flagPrefix + directive
  lines.push(`function ${p}_emit_filtered --no-scope-shadowing`);
  lines.push(`    set -l _prefix "$argv[1]"`);
  lines.push(`    set -l _cur "$argv[2]"`);
  lines.push(`    set -l _dir "$argv[3]"`);
  lines.push(`    set -l _skip_filter "$argv[4]"`);
  lines.push(`    set -l _plen (string length -- "$_cur")`);
  lines.push("    set -l _seen");
  lines.push("    for _item in $_emit_list");
  lines.push(`        set -l _val (string split -m 1 -- $_tab "$_item")[1]`);
  lines.push(`        if test "$_skip_filter" -eq 0`);
  lines.push(
    `            if test $_plen -gt 0; and test (string sub -l $_plen -- "$_val") != "$_cur"`,
  );
  lines.push("                continue");
  lines.push("            end");
  lines.push(`            if contains -- "$_val" $_seen`);
  lines.push("                continue");
  lines.push("            end");
  lines.push(`            set -a _seen "$_val"`);
  lines.push("        end");
  lines.push(`        printf "%s%s\\n" "$_prefix" "$_item"`);
  lines.push("    end");
  lines.push(`    printf ":%s\\n" "$_dir"`);
  lines.push("end");
  lines.push("");

  // Helper: complete a flag value (handles delimiter + static/dynamic/none)
  lines.push(`function ${p}_emit_flag_val --no-scope-shadowing`);
  lines.push(`    set -l _fprefix "$argv[1]"`);
  lines.push(`    set -l _vcur "$argv[2]"`);
  lines.push(`    if test "$_val_kind" = dynamic`);
  if (hasDynamic) {
    lines.push(`        ${p}_dynamic`);
  } else {
    lines.push(`        printf ":${ShellCompDirective.NoFileComp}\\n"`);
  }
  lines.push("        return");
  lines.push("    end");
  lines.push(`    if test "$_val_kind" = none`);
  lines.push(`        printf ":${ShellCompDirective.NoFileComp}\\n"`);
  lines.push("        return");
  lines.push("    end");
  lines.push("    set -l _skip 0");
  lines.push(
    `    set -l _file_mask (math (math --scale 0 $_val_dir / ${ShellCompDirective.FilterFileExt}) % 2)`,
  );
  lines.push(
    `    set -l _dir_mask (math (math --scale 0 $_val_dir / ${ShellCompDirective.FilterDirs}) % 2)`,
  );
  lines.push("    if test $_file_mask -eq 1; or test $_dir_mask -eq 1");
  lines.push("        set _skip 1");
  lines.push("    end");
  lines.push(
    `    if test -n "$_val_delim"; and string match -q -- "*$_val_delim*" "$_vcur"`,
  );
  lines.push(
    `        set -l _parts (string split -r -m 1 -- "$_val_delim" "$_vcur")`,
  );
  lines.push(`        set -l _head "$_parts[1]$_val_delim"`);
  lines.push(`        set -l _icur "$_parts[2]"`);
  lines.push(
    `        set -l _picked (string split -- "$_val_delim" "$_parts[1]")`,
  );
  lines.push("        set -l _emit_list");
  lines.push("        for _item in $_val_items");
  lines.push(`            set -l _v (string split -m 1 -- $_tab "$_item")[1]`);
  lines.push(`            if not contains -- "$_v" $_picked`);
  lines.push(`                set -a _emit_list "$_item"`);
  lines.push("            end");
  lines.push("        end");
  lines.push(
    `        ${p}_emit_filtered "$_fprefix$_head" "$_icur" "$_val_dir" "$_skip"`,
  );
  lines.push("    else");
  lines.push("        set -l _emit_list $_val_items");
  lines.push(
    `        ${p}_emit_filtered "$_fprefix" "$_vcur" "$_val_dir" "$_skip"`,
  );
  lines.push("    end");
  lines.push("end");
  lines.push("");

  // 10. Main completion engine
  lines.push(`function ${p}_perform_completion`);
  lines.push(`    set -l _tab (printf '\\t')`);
  lines.push("    set -l args (commandline -opc)");
  lines.push("    set -l lastArg (commandline -ct)");
  lines.push("    set -l prior $args[2..-1]");
  lines.push("    set -l _node 0");
  lines.push("    set -l _matched_idx");
  lines.push(`    set -l _next_node ""`);
  lines.push(`    set -l _fl_name ""`);
  lines.push("    set -l _fl_takes 0");
  lines.push("    set -l _fl_inline 0");
  lines.push("    set -l _plen (count $prior)");
  lines.push("    set -l _i 1");
  lines.push("    while test $_i -le $_plen");
  lines.push(`        set -l _tok "$prior[$_i]"`);
  lines.push(`        set -l _tlen (string length -- "$_tok")`);
  lines.push(`        if test "$_tok" = "--"`);
  lines.push("            break");
  lines.push(
    `        else if test $_tlen -gt 2; and string match -q -- "--*" "$_tok"`,
  );
  lines.push(`            set -l _rest (string sub -s 3 -- "$_tok")`);
  lines.push("            set -l _has_eq 0");
  lines.push(`            set -l _fname "$_rest"`);
  lines.push(`            if string match -q -- "*=*" "$_rest"`);
  lines.push("                set _has_eq 1");
  lines.push(
    `                set _fname (string split -m 1 -- "=" "$_rest")[1]`,
  );
  lines.push("            end");
  lines.push(`            if not ${p}_flag_long $_node "$_fname"`);
  lines.push("                break");
  lines.push("            end");
  lines.push("            set _i (math $_i + 1)");
  lines.push(
    `            if test $_has_eq -eq 0; and test $_fl_takes -eq 1; and test $_i -le $_plen; and ${p}_can_consume $_node "$prior[$_i]"`,
  );
  lines.push("                set _i (math $_i + 1)");
  lines.push("            end");
  lines.push("            continue");
  lines.push(
    `        else if test $_tlen -ge 2; and string match -q -- "-*" "$_tok"; and ${p}_is_short_start $_node (string sub -s 2 -l 1 -- "$_tok")`,
  );
  lines.push("            set -l _takes_next 0");
  lines.push("            set -l _bad_short 0");
  lines.push("            for _j in (seq 2 $_tlen)");
  lines.push(`                set -l _ch (string sub -s $_j -l 1 -- "$_tok")`);
  lines.push(`                if not ${p}_flag_short $_node "$_ch"`);
  lines.push("                    set _bad_short 1");
  lines.push("                    break");
  lines.push("                end");
  lines.push("                if test $_fl_inline -eq 1");
  lines.push(
    "                    if test $_j -eq $_tlen; and test $_fl_takes -eq 1",
  );
  lines.push("                        set _takes_next 1");
  lines.push("                    end");
  lines.push("                    break");
  lines.push("                end");
  lines.push("            end");
  lines.push("            if test $_bad_short -eq 1");
  lines.push("                break");
  lines.push("            end");
  lines.push("            set _i (math $_i + 1)");
  lines.push(
    `            if test $_takes_next -eq 1; and test $_i -le $_plen; and ${p}_can_consume $_node "$prior[$_i]"`,
  );
  lines.push("                set _i (math $_i + 1)");
  lines.push("            end");
  lines.push("            continue");
  lines.push("        end");
  lines.push(`        if ${p}_transition $_node "$_tok"`);
  lines.push("            set _node $_next_node");
  lines.push("            set -a _matched_idx $_i");
  lines.push("            set _i (math $_i + 1)");
  lines.push("            continue");
  lines.push("        end");
  lines.push("        break");
  lines.push("    end");

  // Build remaining prior tokens
  lines.push("    set -l _rem");
  lines.push("    if test (count $_matched_idx) -eq 0");
  lines.push("        set _rem $prior");
  lines.push("    else");
  lines.push("        for _idx in (seq 1 $_plen)");
  lines.push("            if not contains -- $_idx $_matched_idx");
  lines.push(`                set -a _rem "$prior[$_idx]"`);
  lines.push("            end");
  lines.push("        end");
  lines.push("    end");

  // Determine stopParsing mode for _node
  lines.push("    set -l _stop none");
  if (stopNodes.length > 0) {
    lines.push("    switch $_node");
    for (const node of stopNodes) {
      lines.push(
        `        case ${node.id}`,
        `            set _stop ${node.stopParsing}`,
      );
    }
    lines.push("    end");
  }
  if (hasDynamic) {
    lines.push(`    if test "$_stop" = dynamic; and test (count $_rem) -gt 0`);
    lines.push(`        ${p}_dynamic`);
    lines.push("        return");
    lines.push("    end");
  }

  // Pass B: parse _rem with _node flags
  lines.push("    set -l _used");
  lines.push("    set -l _words");
  lines.push("    set -l _dd_words");
  lines.push("    set -l _after_dd 0");
  lines.push("    set -l _stopped 0");
  lines.push(`    set -l _pending ""`);
  lines.push("    set -l _rlen (count $_rem)");
  lines.push("    set _i 1");
  lines.push("    while test $_i -le $_rlen");
  lines.push(`        set -l _tok "$_rem[$_i]"`);
  lines.push(`        set -l _tlen (string length -- "$_tok")`);
  lines.push(`        if test "$_tok" = "--"`);
  lines.push("            set _after_dd 1");
  lines.push("            if test $_i -lt $_rlen");
  lines.push("                set _dd_words $_rem[(math $_i + 1)..-1]");
  lines.push("            end");
  lines.push("            break");
  lines.push(
    `        else if test $_tlen -gt 2; and string match -q -- "--*" "$_tok"`,
  );
  lines.push(`            set -l _rest (string sub -s 3 -- "$_tok")`);
  lines.push("            set -l _has_eq 0");
  lines.push(`            set -l _fname "$_rest"`);
  lines.push(`            if string match -q -- "*=*" "$_rest"`);
  lines.push("                set _has_eq 1");
  lines.push(
    `                set _fname (string split -m 1 -- "=" "$_rest")[1]`,
  );
  lines.push("            end");
  lines.push(`            if not ${p}_flag_long $_node "$_fname"`);
  lines.push(`                if test "$_stop" = "unknown-flag"`);
  lines.push("                    set _stopped 1");
  lines.push("                    set -a _words $_rem[$_i..-1]");
  lines.push("                    break");
  lines.push("                end");
  lines.push("                set _i (math $_i + 1)");
  lines.push("                continue");
  lines.push("            end");
  lines.push("            if test $_fl_inline -eq 1");
  lines.push(
    "                if test $_has_eq -eq 1; or test $_fl_takes -eq 0",
  );
  lines.push(`                    set -a _used "f:$_fl_name"`);
  lines.push(
    `                else if test (math $_i + 1) -le $_rlen; and ${p}_can_consume $_node "$_rem[(math $_i + 1)]"`,
  );
  lines.push(`                    set -a _used "f:$_fl_name"`);
  lines.push("                    set _i (math $_i + 1)");
  lines.push("                else if test $_i -eq $_rlen");
  lines.push(`                    set _pending "$_fl_name"`);
  lines.push("                end");
  lines.push("            else");
  lines.push(`                set -a _used "f:$_fl_name"`);
  lines.push("            end");
  lines.push("            set _i (math $_i + 1)");
  lines.push("            continue");
  lines.push(
    `        else if test $_tlen -ge 2; and string match -q -- "-*" "$_tok"; and ${p}_is_short_start $_node (string sub -s 2 -l 1 -- "$_tok")`,
  );
  lines.push(`            if test "$_stop" = "unknown-flag"`);
  lines.push("                set -l _all_known 1");
  lines.push("                for _j in (seq 2 $_tlen)");
  lines.push(
    `                    set -l _ch (string sub -s $_j -l 1 -- "$_tok")`,
  );
  lines.push(`                    if not ${p}_flag_short $_node "$_ch"`);
  lines.push("                        set _all_known 0");
  lines.push("                        break");
  lines.push("                    end");
  lines.push("                    if test $_fl_inline -eq 1");
  lines.push("                        break");
  lines.push("                    end");
  lines.push("                end");
  lines.push("                if test $_all_known -eq 0");
  lines.push("                    set _stopped 1");
  lines.push("                    set -a _words $_rem[$_i..-1]");
  lines.push("                    break");
  lines.push("                end");
  lines.push("            end");
  lines.push("            for _j in (seq 2 $_tlen)");
  lines.push(`                set -l _ch (string sub -s $_j -l 1 -- "$_tok")`);
  lines.push(`                if not ${p}_flag_short $_node "$_ch"`);
  lines.push("                    continue");
  lines.push("                end");
  lines.push("                if test $_fl_inline -eq 0");
  lines.push(`                    set -a _used "f:$_fl_name"`);
  lines.push("                else");
  lines.push(
    "                    if test $_j -lt $_tlen; or test $_fl_takes -eq 0",
  );
  lines.push(`                        set -a _used "f:$_fl_name"`);
  lines.push(
    `                    else if test (math $_i + 1) -le $_rlen; and ${p}_can_consume $_node "$_rem[(math $_i + 1)]"`,
  );
  lines.push(`                        set -a _used "f:$_fl_name"`);
  lines.push("                        set _i (math $_i + 1)");
  lines.push("                    else if test $_i -eq $_rlen");
  lines.push(`                        set _pending "$_fl_name"`);
  lines.push("                    end");
  lines.push("                    break");
  lines.push("                end");
  lines.push("            end");
  lines.push("            set _i (math $_i + 1)");
  lines.push("            continue");
  lines.push("        end");
  lines.push(`        if test "$_stop" = "first-positional"`);
  lines.push("            set _stopped 1");
  lines.push("            set -a _words $_rem[$_i..-1]");
  lines.push("            break");
  lines.push("        end");
  lines.push(`        set -a _words "$_tok"`);
  lines.push("        set _i (math $_i + 1)");
  lines.push("    end");

  // Case 1: pending flag value
  lines.push("    set -l _val_kind none");
  lines.push(`    set -l _val_delim ""`);
  lines.push(`    set -l _val_dir ${ShellCompDirective.NoFileComp}`);
  lines.push("    set -l _val_items");
  lines.push(`    if test -n "$_pending"`);
  lines.push(`        ${p}_flag_val $_node "$_pending"`);
  lines.push(`        ${p}_emit_flag_val "" "$lastArg"`);
  lines.push("        return");
  lines.push("    end");

  // Compute conflicts
  lines.push("    set -l _main_cnt (count $_words)");
  lines.push("    set -l _dd_cnt (count $_dd_words)");
  lines.push("    set -l _conf");
  if (nodesWithConflicts.length > 0) {
    lines.push(`    ${p}_conflicts $_node`);
  }

  // Case 2: inline flag value or flag name
  lines.push("    if test $_after_dd -eq 0; and test $_stopped -eq 0");
  lines.push(`        if string match -q -- "-*=*" "$lastArg"`);
  lines.push(
    `            set -l _eq_parts (string split -m 1 -- "=" "$lastArg")`,
  );
  lines.push(`            set -l _lhs "$_eq_parts[1]"`);
  lines.push(`            set -l _rhs "$_eq_parts[2]"`);
  lines.push(`            set -l _inline_hit ""`);
  lines.push(`            if string match -q -- "--*" "$_lhs"`);
  lines.push(`                set -l _fn (string sub -s 3 -- "$_lhs")`);
  lines.push(
    `                if ${p}_flag_long $_node "$_fn"; and test $_fl_inline -eq 1`,
  );
  lines.push(`                    set _inline_hit "$_fl_name"`);
  lines.push("                end");
  lines.push(`            else if test (string length -- "$_lhs") -ge 2`);
  lines.push(`                set -l _llen (string length -- "$_lhs")`);
  lines.push("                for _j in (seq 2 $_llen)");
  lines.push(
    `                    set -l _ch (string sub -s $_j -l 1 -- "$_lhs")`,
  );
  lines.push(
    `                    if ${p}_flag_short $_node "$_ch"; and test $_fl_inline -eq 1`,
  );
  lines.push("                        if test $_j -eq $_llen");
  lines.push(`                            set _inline_hit "$_fl_name"`);
  lines.push("                        end");
  lines.push("                        break");
  lines.push("                    end");
  lines.push("                end");
  lines.push("            end");
  lines.push(`            if test -n "$_inline_hit"`);
  lines.push(`                ${p}_flag_val $_node "$_inline_hit"`);
  lines.push(`                ${p}_emit_flag_val "$_lhs=" "$_rhs"`);
  lines.push("                return");
  lines.push("            end");
  lines.push("        end");
  lines.push(`        if string match -q -- "-*" "$lastArg"`);
  lines.push("            set -l _out_items");
  lines.push(`            ${p}_emit_flags $_node "$lastArg"`);
  lines.push("            set -l _emit_list $_out_items");
  lines.push(
    `            ${p}_emit_filtered "" "$lastArg" ${ShellCompDirective.NoFileComp} 0`,
  );
  lines.push("            return");
  lines.push("        end");
  lines.push("    end");

  // Case 3: built-in help
  if (helpNode) {
    lines.push(`    if test $_node -eq ${helpNode.id}`);
    lines.push("        set -l _hnode 0");
    lines.push("        for _w in $_words");
    lines.push(`            if not ${p}_transition $_hnode "$_w"`);
    lines.push(`                printf ":${ShellCompDirective.NoFileComp}\\n"`);
    lines.push("                return");
    lines.push("            end");
    lines.push("            set _hnode $_next_node");
    lines.push("        end");
    lines.push("        set -l _sub_items");
    lines.push(`        ${p}_subcmds $_hnode 0`);
    lines.push("        set -l _emit_list $_sub_items");
    lines.push(
      `        ${p}_emit_filtered "" "$lastArg" ${ShellCompDirective.NoFileComp} 0`,
    );
    lines.push("        return");
    lines.push("    end");
  }

  // Case 4: subcommands + positional args
  lines.push("    set -l _sub_items");
  lines.push("    if test $_after_dd -eq 0; and test $_main_cnt -eq 0");
  lines.push("        set -l _inc_alias 0");
  lines.push(`        if test -n "$lastArg"`);
  lines.push("            set _inc_alias 1");
  lines.push("        end");
  lines.push(`        ${p}_subcmds $_node $_inc_alias`);
  lines.push("    end");

  if (disabledNodes.length > 0) {
    lines.push("    switch $_node");
    lines.push(`        case ${disabledNodes.map((n) => n.id).join(" ")}`);
    lines.push("            set -l _emit_list $_sub_items");
    lines.push(
      `            ${p}_emit_filtered "" "$lastArg" ${ShellCompDirective.NoFileComp} 0`,
    );
    lines.push("            return");
    lines.push("    end");
  }

  lines.push(`    ${p}_pos_val $_node`);
  lines.push(`    if test "$_val_kind" = dynamic`);
  if (hasDynamic) {
    lines.push(`        ${p}_dynamic`);
  } else {
    lines.push(`        printf ":${ShellCompDirective.NoFileComp}\\n"`);
  }
  lines.push("        return");
  lines.push("    end");
  lines.push(`    if test "$_val_kind" = none`);
  lines.push("        set -l _emit_list $_sub_items");
  lines.push(
    `        ${p}_emit_filtered "" "$lastArg" ${ShellCompDirective.NoFileComp} 0`,
  );
  lines.push("        return");
  lines.push("    end");
  lines.push("    set -l _skip 0");
  lines.push(
    `    set -l _file_mask (math (math --scale 0 $_val_dir / ${ShellCompDirective.FilterFileExt}) % 2)`,
  );
  lines.push(
    `    set -l _dir_mask (math (math --scale 0 $_val_dir / ${ShellCompDirective.FilterDirs}) % 2)`,
  );
  lines.push("    if test $_file_mask -eq 1; or test $_dir_mask -eq 1");
  lines.push("        set _skip 1");
  lines.push("    end");
  lines.push("    set -l _emit_list $_sub_items $_val_items");
  lines.push(`    ${p}_emit_filtered "" "$lastArg" "$_val_dir" "$_skip"`);
  lines.push("end");
  lines.push("");

  // Fish wrapper functions & registration (preserves native directive handling & autoload guard)
  lines.push(`function ${p}_perform_completion_once`);
  lines.push(`    if test -n "$${p}_perform_completion_once_result"`);
  lines.push("        return 0");
  lines.push("    end");
  lines.push(
    `    set --global ${p}_perform_completion_once_result (${p}_perform_completion)`,
  );
  lines.push(`    if test -z "$${p}_perform_completion_once_result"`);
  lines.push("        return 1");
  lines.push("    end");
  lines.push("    return 0");
  lines.push("end");
  lines.push("");
  lines.push(`function ${p}_clear_perform_completion_once_result`);
  lines.push(`    set --erase ${p}_perform_completion_once_result`);
  lines.push("end");
  lines.push("");
  lines.push(`function ${p}_requires_order_preservation`);
  lines.push(`    ${p}_perform_completion_once`);
  lines.push(`    if test -z "$${p}_perform_completion_once_result"`);
  lines.push("        return 1");
  lines.push("    end");
  lines.push(
    `    set -l directive (string sub --start 2 $${p}_perform_completion_once_result[-1])`,
  );
  lines.push(
    `    set -l shellCompDirectiveKeepOrder ${ShellCompDirective.KeepOrder}`,
  );
  lines.push(
    "    set -l keeporder (math (math --scale 0 $directive / $shellCompDirectiveKeepOrder) % 2)",
  );
  lines.push("    if test $keeporder -ne 0");
  lines.push("        return 0");
  lines.push("    end");
  lines.push("    return 1");
  lines.push("end");
  lines.push("");
  lines.push(`function ${p}_prepare_completions`);
  lines.push(`    set --erase ${p}_comp_results`);
  lines.push(`    ${p}_perform_completion_once`);
  lines.push(`    if test -z "$${p}_perform_completion_once_result"`);
  lines.push("        return 1");
  lines.push("    end");
  lines.push("");
  lines.push(
    `    set -l directive (string sub --start 2 $${p}_perform_completion_once_result[-1])`,
  );
  lines.push(
    `    set --global ${p}_comp_results $${p}_perform_completion_once_result[1..-2]`,
  );
  lines.push("");
  lines.push(`    set -l shellCompDirectiveError ${ShellCompDirective.Error}`);
  lines.push(
    `    set -l shellCompDirectiveNoSpace ${ShellCompDirective.NoSpace}`,
  );
  lines.push(
    `    set -l shellCompDirectiveNoFileComp ${ShellCompDirective.NoFileComp}`,
  );
  lines.push(
    `    set -l shellCompDirectiveFilterFileExt ${ShellCompDirective.FilterFileExt}`,
  );
  lines.push(
    `    set -l shellCompDirectiveFilterDirs ${ShellCompDirective.FilterDirs}`,
  );
  lines.push("");
  lines.push(`    if test -z "$directive"`);
  lines.push("        set directive 0");
  lines.push("    end");
  lines.push("");
  lines.push(
    "    set -l compErr (math (math --scale 0 $directive / $shellCompDirectiveError) % 2)",
  );
  lines.push("    if test $compErr -eq 1");
  lines.push("        return 1");
  lines.push("    end");
  lines.push("");
  lines.push(
    "    set -l filefilter (math (math --scale 0 $directive / $shellCompDirectiveFilterFileExt) % 2)",
  );
  lines.push(
    "    set -l dirfilter (math (math --scale 0 $directive / $shellCompDirectiveFilterDirs) % 2)",
  );
  lines.push("    if test $filefilter -eq 1; or test $dirfilter -eq 1");
  lines.push("        set -l _cur_tok (commandline -ct)");
  lines.push(
    "        set -l _flag_prefix (string match -r -- '-.*=' \"$_cur_tok\")",
  );
  lines.push('        set -l _match_cur "$_cur_tok"');
  lines.push('        set -l _fplen (string length -- "$_flag_prefix")');
  lines.push("        if test $_fplen -gt 0");
  lines.push(
    '            set _match_cur (string sub -s (math $_fplen + 1) -- "$_cur_tok")',
  );
  lines.push("        end");
  lines.push('        set -l _dir_part ""');
  lines.push('        if string match -q -- "*/*" "$_match_cur"');
  lines.push(
    '            set -l _sp (string split -r -m 1 -- "/" "$_match_cur")',
  );
  lines.push('            set _dir_part "$_sp[1]/"');
  lines.push("        end");
  lines.push('        set -l _mlen (string length -- "$_match_cur")');
  lines.push("        set -l _show_dot 0");
  lines.push("        if string match -qr -- '(^|/)\\.' \"$_match_cur\"");
  lines.push("            set _show_dot 1");
  lines.push("        end");
  lines.push("        set -l _paths");
  lines.push('        for _d in "$_dir_part"*/');
  lines.push(
    '            if test $_mlen -eq 0; or test (string sub -l $_mlen -- "$_d") = "$_match_cur"',
  );
  lines.push('                set -a _paths "$_flag_prefix$_d"');
  lines.push("            end");
  lines.push("        end");
  lines.push("        if test $_show_dot -eq 1");
  lines.push('            for _d in "$_dir_part".*/');
  lines.push(
    '                if test $_mlen -eq 0; or test (string sub -l $_mlen -- "$_d") = "$_match_cur"',
  );
  lines.push('                    set -a _paths "$_flag_prefix$_d"');
  lines.push("                end");
  lines.push("            end");
  lines.push("        end");
  lines.push("        if test $filefilter -eq 1");
  lines.push("            set -l _exts");
  lines.push(`            for _e in $${p}_comp_results`);
  lines.push("                if test $_fplen -gt 0");
  lines.push(
    '                    set _e (string sub -s (math $_fplen + 1) -- "$_e")',
  );
  lines.push("                end");
  lines.push('                set -a _exts "$_e"');
  lines.push("            end");
  lines.push("            for _ext in $_exts");
  lines.push('                for _f in "$_dir_part"*.\'\'"$_ext"');
  lines.push(
    '                    if test $_mlen -eq 0; or test (string sub -l $_mlen -- "$_f") = "$_match_cur"',
  );
  lines.push('                        set -a _paths "$_flag_prefix$_f"');
  lines.push("                    end");
  lines.push("                end");
  lines.push("                if test $_show_dot -eq 1");
  lines.push('                    for _f in "$_dir_part".*.\'\'"$_ext"');
  lines.push(
    '                        if test $_mlen -eq 0; or test (string sub -l $_mlen -- "$_f") = "$_match_cur"',
  );
  lines.push('                            set -a _paths "$_flag_prefix$_f"');
  lines.push("                        end");
  lines.push("                    end");
  lines.push("                end");
  lines.push("            end");
  lines.push("        end");
  lines.push(`        set --global ${p}_comp_results $_paths`);
  lines.push("        return 0");
  lines.push("    end");
  lines.push("");
  lines.push(
    "    set -l nospace (math (math --scale 0 $directive / $shellCompDirectiveNoSpace) % 2)",
  );
  lines.push(
    "    set -l nofiles (math (math --scale 0 $directive / $shellCompDirectiveNoFileComp) % 2)",
  );
  lines.push("");
  lines.push("    if test $nospace -ne 0; or test $nofiles -eq 0");
  lines.push(
    "        set -l prefix (commandline -t | string escape --style=regex)",
  );
  lines.push(
    `        set -l completions (string match -r -- "^$prefix.*" $${p}_comp_results)`,
  );
  lines.push(`        set --global ${p}_comp_results $completions`);
  lines.push(`        set -l numComps (count $${p}_comp_results)`);
  lines.push("");
  lines.push("        if test $numComps -eq 1; and test $nospace -ne 0");
  lines.push(
    `            set -l split (string split --max 1 "\\t" $${p}_comp_results[1])`,
  );
  lines.push("            set -l lastChar (string sub -s -1 -- $split)");
  lines.push(`            if not string match -r -q "[@=/:.,]" -- "$lastChar"`);
  lines.push(
    `                set --global ${p}_comp_results $split[1] $split[1].`,
  );
  lines.push("            end");
  lines.push("        end");
  lines.push("");
  lines.push("        if test $numComps -eq 0; and test $nofiles -eq 0");
  lines.push("            return 1");
  lines.push("        end");
  lines.push("    end");
  lines.push("");
  lines.push("    return 0");
  lines.push("end");
  lines.push("");
  lines.push(`if type -q ${fishQuote(name)}`);
  lines.push(
    `    complete --do-complete ${fishQuote(`${name} `)} > /dev/null 2>&1`,
  );
  lines.push("end");
  lines.push("");
  lines.push(`complete -c ${name} -e`);
  lines.push(
    `complete -c ${name} -n '${p}_clear_perform_completion_once_result'`,
  );
  lines.push(
    `complete -c ${name} -n 'not ${p}_requires_order_preservation && ${p}_prepare_completions' -f -a '$${p}_comp_results'`,
  );
  lines.push(
    `complete -k -c ${name} -n '${p}_requires_order_preservation && ${p}_prepare_completions' -f -a '$${p}_comp_results'`,
  );

  return lines.join("\n");
}
