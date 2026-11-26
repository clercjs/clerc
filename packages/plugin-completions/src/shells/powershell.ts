import { ShellCompDirective } from "../directives";
import type {
  StaticCandidate,
  StaticCompletionSpec,
  StaticNodeSpec,
  StaticValueSpec,
} from "../spec";
import { psQuote } from "./utils";

const psCandidateExpr = (item: StaticCandidate): string =>
  `@{ V = ${psQuote(item.value)}; D = ${psQuote(item.description)} }`;

function psShortStartRegex(node: StaticNodeSpec): string {
  const digits = node.flags
    .map((f) => f.short)
    .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
    .join("");

  return digits ? `^(--|-[A-Za-z${digits}])` : "^(--|-[A-Za-z])";
}

function emitValueExpr(spec: StaticValueSpec): string {
  if (spec.kind === "dynamic") {
    return `@{ Kind = 'dynamic' }`;
  }
  if (spec.kind === "none") {
    return `@{ Kind = 'none' }`;
  }
  const items = spec.candidates.map(psCandidateExpr).join(", ");

  return `@{ Kind = 'static'; Dir = ${spec.directive}; Items = @(${items}) }`;
}

export function renderPowerShellScript(spec: StaticCompletionSpec): string {
  const { name, bin, fn, hasDynamic, nodes } = spec;
  const p = `__${fn}`;
  const lines: string[] = [];

  lines.push(`# powershell completion for ${name} -*- shell-script -*-`);
  lines.push("");
  lines.push("[Console]::OutputEncoding = [System.Text.Encoding]::UTF8");
  lines.push("");
  lines.push(`filter ${p}_escapeStringWithSpecialChars {`);
  lines.push(
    `    $_ -replace '\\s|#|@|\\$|;|,|''|\\{|\\}|\\(|\\)|"|\\||<|>|&','\`$&'`,
  );
  lines.push("}");
  lines.push("");
  lines.push(`[scriptblock]$${p}CompleterBlock = {`);
  lines.push("    param($WordToComplete, $CommandAst, $CursorPosition)");
  lines.push("");
  lines.push(`    $ShellCompDirectiveError = ${ShellCompDirective.Error}`);
  lines.push(`    $ShellCompDirectiveNoSpace = ${ShellCompDirective.NoSpace}`);
  lines.push(
    `    $ShellCompDirectiveNoFileComp = ${ShellCompDirective.NoFileComp}`,
  );
  lines.push(
    `    $ShellCompDirectiveFilterFileExt = ${ShellCompDirective.FilterFileExt}`,
  );
  lines.push(
    `    $ShellCompDirectiveFilterDirs = ${ShellCompDirective.FilterDirs}`,
  );
  lines.push(
    `    $ShellCompDirectiveKeepOrder = ${ShellCompDirective.KeepOrder}`,
  );
  lines.push("");
  lines.push("    $prior = [System.Collections.Generic.List[string]]::new()");
  lines.push("    $cur = $WordToComplete");
  lines.push("    $elems = $CommandAst.CommandElements");
  lines.push("    for ($idx = 1; $idx -lt $elems.Count; $idx++) {");
  lines.push("        $el = $elems[$idx]");
  lines.push("        if ($el.Extent.EndOffset -lt $CursorPosition) {");
  lines.push(
    "            $txt = if ($el -is [System.Management.Automation.Language.StringConstantExpressionAst]) { $el.Value } else { $el.Extent.Text }",
  );
  lines.push("            $prior.Add($txt)");
  lines.push(
    "        } elseif ($el.Extent.StartOffset -le $CursorPosition -and $el.Extent.EndOffset -ge $CursorPosition) {",
  );
  lines.push(
    `            if ($WordToComplete -eq '' -and $el.Extent.EndOffset -eq $CursorPosition) {`,
  );
  lines.push(
    "                $txt = if ($el -is [System.Management.Automation.Language.StringConstantExpressionAst]) { $el.Value } else { $el.Extent.Text }",
  );
  lines.push("                $cur = $txt");
  lines.push(`            } elseif ($el.Extent.Text -like '-*=*') {`);
  lines.push("                $cur = $el.Extent.Text");
  lines.push("            }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push("    function Get-Transition([int]$nid, [string]$tok) {");
  lines.push(`        switch -Exact -CaseSensitive ("$nid:$tok") {`);
  for (const node of nodes) {
    for (const tr of node.transitions) {
      lines.push(
        `            ${psQuote(`${node.id}:${tr.token}`)} { return ${tr.targetId} }`,
      );
    }
  }
  lines.push("            default { return -1 }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push("    function Get-LongFlag([int]$nid, [string]$fname) {");
  lines.push(`        switch -Exact -CaseSensitive ("$nid:$fname") {`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      const patterns = flag.longParseNames
        .map((n) => psQuote(`${node.id}:${n}`))
        .join(", ");
      lines.push(
        `            { $_ -cin @(${patterns}) } { return @{ Name = ${psQuote(flag.name)}; Takes = $${flag.takesValue}; Inline = $${flag.acceptsInlineValue} } }`,
      );
    }
  }
  lines.push("            default { return $null }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push("    function Get-ShortFlag([int]$nid, [string]$ch) {");
  lines.push(`        switch -Exact -CaseSensitive ("$nid:$ch") {`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (!flag.short) {
        continue;
      }
      lines.push(
        `            ${psQuote(`${node.id}:${flag.short}`)} { return @{ Name = ${psQuote(flag.name)}; Takes = $${flag.takesValue}; Inline = $${flag.acceptsInlineValue} } }`,
      );
    }
  }
  lines.push("            default { return $null }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push("    function Get-FlagVal([int]$nid, [string]$cname) {");
  lines.push(`        switch -Exact -CaseSensitive ("$nid:$cname") {`);
  for (const node of nodes) {
    for (const flag of node.flags) {
      if (flag.value.kind === "none") {
        continue;
      }
      const base = emitValueExpr(flag.value);
      const withDelim = flag.delimiter
        ? base.replace(/\}$/, `; Delim = ${psQuote(flag.delimiter)} }`)
        : base;
      lines.push(
        `            ${psQuote(`${node.id}:${flag.name}`)} { return ${withDelim} }`,
      );
    }
  }
  lines.push(`            default { return @{ Kind = 'none' } }`);
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push("    function Get-Subcmds([int]$nid, [bool]$incAliases) {");
  lines.push("        switch ($nid) {");
  for (const node of nodes) {
    if (
      node.visibleSubcommands.length === 0 &&
      node.visibleAliases.length === 0
    ) {
      continue;
    }
    const subs = node.visibleSubcommands.map(psCandidateExpr).join(", ");
    const aliases = node.visibleAliases.map(psCandidateExpr).join(", ");
    lines.push(`            ${node.id} {`);
    lines.push(`                $res = @(${subs})`);
    if (node.visibleAliases.length > 0) {
      lines.push(`                if ($incAliases) { $res += @(${aliases}) }`);
    }
    lines.push("                return ,$res");
    lines.push("            }");
  }
  lines.push("            default { return ,@() }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  lines.push(
    "    function Get-Flags([int]$nid, [string]$c, $usedSet, $confSet) {",
  );
  lines.push(
    `        $isDd = $c.StartsWith('--', [System.StringComparison]::Ordinal)`,
  );
  lines.push("        $isShortOnly = (-not $isDd) -and ($c.Length -gt 1)");
  lines.push(
    `        $showNeg = $c.StartsWith('--no', [System.StringComparison]::Ordinal)`,
  );
  lines.push("        $res = [System.Collections.Generic.List[object]]::new()");
  lines.push("        switch ($nid) {");
  for (const node of nodes) {
    const completable = node.flags.filter((f) => f.completable);
    if (completable.length === 0) {
      continue;
    }
    lines.push(`            ${node.id} {`);
    for (const flag of completable) {
      const fkey = psQuote(`f:${flag.name}`);
      const conds: string[] = [];
      if (!flag.repeatable) {
        conds.push(`(-not $usedSet.Contains(${fkey}))`);
      }
      conds.push(`(-not $confSet.Contains(${fkey}))`);
      lines.push(`                if (${conds.join(" -and ")}) {`);
      lines.push("                    if (-not $isShortOnly) {");
      lines.push(
        `                        $res.Add(${psCandidateExpr({ value: flag.target, description: flag.description })})`,
      );
      for (const alias of flag.aliases) {
        lines.push(
          `                        $res.Add(${psCandidateExpr({ value: `--${alias}`, description: flag.description })})`,
        );
      }
      if (flag.negatable) {
        const negExpr = psCandidateExpr({
          value: `--no-${flag.target.slice(2)}`,
          description: flag.description,
        });
        if (flag.defaultTrue) {
          lines.push(`                        $res.Add(${negExpr})`);
        } else {
          lines.push(
            `                        if ($showNeg) { $res.Add(${negExpr}) }`,
          );
        }
      }
      lines.push("                    }");
      if (flag.short) {
        lines.push(
          `                    if (-not $isDd) { $res.Add(${psCandidateExpr({ value: `-${flag.short}`, description: flag.description })}) }`,
        );
      }
      lines.push("                }");
    }
    lines.push("            }");
  }
  lines.push("        }");
  lines.push("        return ,$res.ToArray()");
  lines.push("    }");
  lines.push("");

  const nodesWithConflicts = nodes.filter((n) => n.conflictGroups.length > 0);
  if (nodesWithConflicts.length > 0) {
    lines.push(
      "    function Get-Conflicts([int]$nid, $usedSet, [int]$mainCnt, [int]$ddCnt) {",
    );
    lines.push(
      "        $all = [System.Collections.Generic.HashSet[string]]::new($usedSet, [System.StringComparer]::Ordinal)",
    );
    lines.push(
      `        for ($k = 0; $k -lt $mainCnt; $k++) { [void]$all.Add("m:$k") }`,
    );
    lines.push(
      `        for ($k = 0; $k -lt $ddCnt; $k++) { [void]$all.Add("d:$k") }`,
    );
    lines.push(
      "        $conf = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)",
    );
    lines.push("        $groups = switch ($nid) {");
    for (const node of nodesWithConflicts) {
      const grpList = node.conflictGroups
        .map((g) => `@(${g.map(psQuote).join(", ")})`)
        .join(", ");
      lines.push(`            ${node.id} { ,@(${grpList}) }`);
    }
    lines.push("            default { ,@() }");
    lines.push("        }");
    lines.push("        foreach ($grp in $groups) {");
    lines.push("            $hit = $false");
    lines.push(
      "            foreach ($m in $grp) { if ($all.Contains($m)) { $hit = $true; break } }",
    );
    lines.push(
      "            if ($hit) { foreach ($m in $grp) { if (-not $all.Contains($m)) { [void]$conf.Add($m) } } }",
    );
    lines.push("        }");
    lines.push("        return $conf");
    lines.push("    }");
    lines.push("");
  }

  lines.push(
    "    function Get-PosVal([int]$nid, [bool]$afterDd, [int]$mainCnt, [int]$ddCnt, $confSet) {",
  );
  lines.push("        switch ($nid) {");
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
    lines.push(`            ${node.id} {`);
    function emitSlice(
      slice: StaticNodeSpec["mainArgs"],
      prefix: "m" | "d",
      idxExpr: string,
      indent: string,
    ): string[] {
      if (slice.length === 0) {
        return [`${indent}return ${emitValueExpr(node.overflowValue)}`];
      }
      const last = slice.at(-1)!;
      const out: string[] = [`${indent}$aidx = ${idxExpr}`];
      if (last.isVariadic) {
        out.push(
          `${indent}if ($aidx -ge ${slice.length}) { $aidx = ${slice.length - 1} }`,
        );
      }
      out.push(
        `${indent}if ($confSet.Contains("${prefix}:$aidx")) { return @{ Kind = 'none' } }`,
      );
      out.push(`${indent}switch ($aidx) {`);
      for (const [idx, arg] of slice.entries()) {
        out.push(`${indent}    ${idx} { return ${emitValueExpr(arg.value)} }`);
      }
      if (!last.isVariadic && node.overflowValue.kind !== "none") {
        out.push(
          `${indent}    default { return ${emitValueExpr(node.overflowValue)} }`,
        );
      } else {
        out.push(`${indent}    default { return @{ Kind = 'none' } }`);
      }
      out.push(`${indent}}`);

      return out;
    }

    lines.push("                if ($afterDd) {");
    if (node.ddArgs.length > 0) {
      lines.push(
        ...emitSlice(node.ddArgs, "d", "$ddCnt", "                    "),
      );
    } else if (node.hasDoubleDashToken) {
      lines.push(
        `                    return ${emitValueExpr(node.overflowValue)}`,
      );
    } else {
      lines.push(
        ...emitSlice(
          node.mainArgs,
          "m",
          "($mainCnt + $ddCnt)",
          "                    ",
        ),
      );
    }
    lines.push("                } else {");
    lines.push(
      ...emitSlice(node.mainArgs, "m", "$mainCnt", "                    "),
    );
    lines.push("                }");
    lines.push("            }");
  }
  lines.push(`            default { return @{ Kind = 'none' } }`);
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  const digitNodes = nodes.filter((n) => n.hasDigitShort);
  const stopNodes = nodes.filter((n) => n.stopParsing !== "none");
  const helpNode = nodes.find((n) => n.isBuiltinHelp);
  const disabledNodes = nodes.filter((n) => n.positionalsDisabled);

  lines.push("    function Test-CanConsume([int]$nid, [string]$tok) {");
  if (digitNodes.length > 0) {
    lines.push("        $re = switch ($nid) {");
    for (const node of digitNodes) {
      lines.push(
        `            ${node.id} { ${psQuote(psShortStartRegex(node))} }`,
      );
    }
    lines.push(`            default { '^(--|-[A-Za-z])' }`);
    lines.push("        }");
    lines.push("        return ($tok -cnotmatch $re)");
  } else {
    lines.push(`        return ($tok -cnotmatch '^(--|-[A-Za-z])')`);
  }
  lines.push("    }");
  lines.push("");

  lines.push("    function Test-ShortStart([int]$nid, [string]$ch) {");
  if (digitNodes.length > 0) {
    lines.push("        $re = switch ($nid) {");
    for (const node of digitNodes) {
      const digits = node.flags
        .map((f) => f.short)
        .filter((s): s is string => s !== undefined && s >= "0" && s <= "9")
        .join("");
      lines.push(`            ${node.id} { ${psQuote(`^[A-Za-z${digits}]`)} }`);
    }
    lines.push(`            default { '^[A-Za-z]' }`);
    lines.push("        }");
    lines.push("        return ($ch -cmatch $re)");
  } else {
    lines.push(`        return ($ch -cmatch '^[A-Za-z]')`);
  }
  lines.push("    }");
  lines.push("");

  lines.push(
    "    function Filter-Items($items, [string]$prefix, [string]$curStr, [bool]$skipFilter) {",
  );
  lines.push(
    "        $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)",
  );
  lines.push("        $out = [System.Collections.Generic.List[object]]::new()");
  lines.push("        foreach ($it in $items) {");
  lines.push("            $v = [string]$it.V");
  lines.push("            if (-not $skipFilter) {");
  lines.push(
    "                if (-not $v.StartsWith($curStr, [System.StringComparison]::Ordinal)) { continue }",
  );
  lines.push("                if (-not $seen.Add($v)) { continue }");
  lines.push("            }");
  lines.push(
    `            $out.Add(@{ Name = "$prefix$v"; Description = if ($it.D) { $it.D } else { ' ' } })`,
  );
  lines.push("        }");
  lines.push("        return ,$out.ToArray()");
  lines.push("    }");
  lines.push("");

  lines.push("    function Resolve-FlagVal($spec, [string]$vcur) {");
  lines.push(
    `        if ($spec.Kind -eq 'dynamic') { return @{ Dynamic = $true } }`,
  );
  lines.push(
    `        if ($spec.Kind -eq 'none') { return @{ Dynamic = $false; Dir = $ShellCompDirectiveNoFileComp; Items = @() } }`,
  );
  lines.push("        $dir = [int]$spec.Dir");
  lines.push(
    "        $skip = (($dir -band ($ShellCompDirectiveFilterFileExt -bor $ShellCompDirectiveFilterDirs)) -ne 0)",
  );
  lines.push("        $delim = $spec.Delim");
  lines.push("        if ($delim -and $vcur.Contains($delim)) {");
  lines.push(
    "            $lastIdx = $vcur.LastIndexOf($delim, [System.StringComparison]::Ordinal)",
  );
  lines.push(
    "            $head = $vcur.Substring(0, $lastIdx + $delim.Length)",
  );
  lines.push("            $icur = $vcur.Substring($lastIdx + $delim.Length)");
  lines.push(
    "            $picked = [System.Collections.Generic.HashSet[string]]::new([string[]]$vcur.Substring(0, $lastIdx).Split([string[]]@($delim), [System.StringSplitOptions]::None), [System.StringComparer]::Ordinal)",
  );
  lines.push(
    "            $avail = @($spec.Items | Where-Object { -not $picked.Contains([string]$_.V) })",
  );
  lines.push(
    "            return @{ Dynamic = $false; Dir = $dir; Items = (Filter-Items $avail $head $icur $skip) }",
  );
  lines.push("        }");
  lines.push(
    `        return @{ Dynamic = $false; Dir = $dir; Items = (Filter-Items $spec.Items '' $vcur $skip) }`,
  );
  lines.push("    }");
  lines.push("");

  lines.push("    $node = 0");
  lines.push("    $matched = [System.Collections.Generic.HashSet[int]]::new()");
  lines.push("    $i = 0");
  lines.push("    while ($i -lt $prior.Count) {");
  lines.push("        $tok = $prior[$i]");
  lines.push(`        if ($tok -ceq '--') { break }`);
  lines.push(
    `        if ($tok.Length -gt 2 -and $tok.StartsWith('--', [System.StringComparison]::Ordinal)) {`,
  );
  lines.push("            $rest = $tok.Substring(2)");
  lines.push(`            $eq = $rest.IndexOf('=')`);
  lines.push(
    "            $fname = if ($eq -eq -1) { $rest } else { $rest.Substring(0, $eq) }",
  );
  lines.push("            $fl = Get-LongFlag $node $fname");
  lines.push("            if ($null -eq $fl) { break }");
  lines.push("            $i++");
  lines.push(
    "            if ($eq -eq -1 -and $fl.Takes -and $i -lt $prior.Count -and (Test-CanConsume $node $prior[$i])) { $i++ }",
  );
  lines.push("            continue");
  lines.push("        }");
  lines.push(
    `        if ($tok.Length -ge 2 -and $tok[0] -eq '-' -and (Test-ShortStart $node ([string]$tok[1]))) {`,
  );
  lines.push("            $takesNext = $false; $bad = $false");
  lines.push("            for ($j = 1; $j -lt $tok.Length; $j++) {");
  lines.push("                $fl = Get-ShortFlag $node ([string]$tok[$j])");
  lines.push("                if ($null -eq $fl) { $bad = $true; break }");
  lines.push(
    "                if ($fl.Inline) { if ($j -eq $tok.Length - 1 -and $fl.Takes) { $takesNext = $true }; break }",
  );
  lines.push("            }");
  lines.push("            if ($bad) { break }");
  lines.push("            $i++");
  lines.push(
    "            if ($takesNext -and $i -lt $prior.Count -and (Test-CanConsume $node $prior[$i])) { $i++ }",
  );
  lines.push("            continue");
  lines.push("        }");
  lines.push("        $next = Get-Transition $node $tok");
  lines.push(
    "        if ($next -ge 0) { $node = $next; [void]$matched.Add($i); $i++; continue }",
  );
  lines.push("        break");
  lines.push("    }");
  lines.push("");

  lines.push("    $rem = [System.Collections.Generic.List[string]]::new()");
  lines.push(
    "    for ($i = 0; $i -lt $prior.Count; $i++) { if (-not $matched.Contains($i)) { $rem.Add($prior[$i]) } }",
  );
  lines.push("");

  lines.push(`    $stop = 'none'`);
  if (stopNodes.length > 0) {
    lines.push("    $stop = switch ($node) {");
    for (const node of stopNodes) {
      lines.push(`        ${node.id} { ${psQuote(node.stopParsing)} }`);
    }
    lines.push(`        default { 'none' }`);
    lines.push("    }");
  }
  lines.push("");

  lines.push("    $useDynamic = $false");
  lines.push("    [int]$Directive = $ShellCompDirectiveNoFileComp");
  lines.push("    [Array]$Values = @()");
  lines.push(`    $IsEqualFlag = ($cur -like '-*=*')`);
  lines.push(`    $Flag = ''`);
  lines.push("    $MatchCur = $cur");
  lines.push("    if ($IsEqualFlag) {");
  lines.push(`        $eqIdx = $cur.IndexOf('=')`);
  lines.push("        $Flag = $cur.Substring(0, $eqIdx)");
  lines.push("        $MatchCur = $cur.Substring($eqIdx + 1)");
  lines.push("    }");
  lines.push("");

  if (hasDynamic) {
    lines.push(
      `    if ($stop -eq 'dynamic' -and $rem.Count -gt 0) { $useDynamic = $true }`,
    );
  }

  lines.push("    if (-not $useDynamic) {");
  lines.push(
    "        $used = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)",
  );
  lines.push(
    "        $words = [System.Collections.Generic.List[string]]::new()",
  );
  lines.push(
    "        $ddWords = [System.Collections.Generic.List[string]]::new()",
  );
  lines.push(`        $afterDd = $false; $stopped = $false; $pending = ''`);
  lines.push("        $i = 0");
  lines.push("        while ($i -lt $rem.Count) {");
  lines.push("            $tok = $rem[$i]");
  lines.push(`            if ($tok -ceq '--') {`);
  lines.push("                $afterDd = $true");
  lines.push(
    "                for ($k = $i + 1; $k -lt $rem.Count; $k++) { $ddWords.Add($rem[$k]) }",
  );
  lines.push("                break");
  lines.push("            }");
  lines.push(
    `            if ($tok.Length -gt 2 -and $tok.StartsWith('--', [System.StringComparison]::Ordinal)) {`,
  );
  lines.push("                $rest = $tok.Substring(2)");
  lines.push(`                $eq = $rest.IndexOf('=')`);
  lines.push(
    "                $fname = if ($eq -eq -1) { $rest } else { $rest.Substring(0, $eq) }",
  );
  lines.push("                $fl = Get-LongFlag $node $fname");
  lines.push("                if ($null -eq $fl) {");
  lines.push(`                    if ($stop -eq 'unknown-flag') {`);
  lines.push("                        $stopped = $true");
  lines.push(
    "                        for ($k = $i; $k -lt $rem.Count; $k++) { $words.Add($rem[$k]) }",
  );
  lines.push("                        break");
  lines.push("                    }");
  lines.push("                    $i++; continue");
  lines.push("                }");
  lines.push("                if ($fl.Inline) {");
  lines.push(
    `                    if ($eq -ne -1 -or (-not $fl.Takes)) { [void]$used.Add("f:$($fl.Name)") }`,
  );
  lines.push(
    `                    elseif ($i + 1 -lt $rem.Count -and (Test-CanConsume $node $rem[$i + 1])) { [void]$used.Add("f:$($fl.Name)"); $i++ }`,
  );
  lines.push(
    "                    elseif ($i -eq $rem.Count - 1) { $pending = $fl.Name }",
  );
  lines.push(`                } else { [void]$used.Add("f:$($fl.Name)") }`);
  lines.push("                $i++; continue");
  lines.push("            }");
  lines.push(
    `            if ($tok.Length -ge 2 -and $tok[0] -eq '-' -and (Test-ShortStart $node ([string]$tok[1]))) {`,
  );
  lines.push(`                if ($stop -eq 'unknown-flag') {`);
  lines.push("                    $allKnown = $true");
  lines.push("                    for ($j = 1; $j -lt $tok.Length; $j++) {");
  lines.push(
    "                        $fl = Get-ShortFlag $node ([string]$tok[$j])",
  );
  lines.push(
    "                        if ($null -eq $fl) { $allKnown = $false; break }",
  );
  lines.push("                        if ($fl.Inline) { break }");
  lines.push("                    }");
  lines.push("                    if (-not $allKnown) {");
  lines.push("                        $stopped = $true");
  lines.push(
    "                        for ($k = $i; $k -lt $rem.Count; $k++) { $words.Add($rem[$k]) }",
  );
  lines.push("                        break");
  lines.push("                    }");
  lines.push("                }");
  lines.push("                for ($j = 1; $j -lt $tok.Length; $j++) {");
  lines.push(
    "                    $fl = Get-ShortFlag $node ([string]$tok[$j])",
  );
  lines.push("                    if ($null -eq $fl) { continue }");
  lines.push(
    `                    if (-not $fl.Inline) { [void]$used.Add("f:$($fl.Name)") }`,
  );
  lines.push("                    else {");
  lines.push(
    `                        if ($j + 1 -lt $tok.Length -or (-not $fl.Takes)) { [void]$used.Add("f:$($fl.Name)") }`,
  );
  lines.push(
    `                        elseif ($i + 1 -lt $rem.Count -and (Test-CanConsume $node $rem[$i + 1])) { [void]$used.Add("f:$($fl.Name)"); $i++ }`,
  );
  lines.push(
    "                        elseif ($i -eq $rem.Count - 1) { $pending = $fl.Name }",
  );
  lines.push("                        break");
  lines.push("                    }");
  lines.push("                }");
  lines.push("                $i++; continue");
  lines.push("            }");
  lines.push(`            if ($stop -eq 'first-positional') {`);
  lines.push("                $stopped = $true");
  lines.push(
    "                for ($k = $i; $k -lt $rem.Count; $k++) { $words.Add($rem[$k]) }",
  );
  lines.push("                break");
  lines.push("            }");
  lines.push("            $words.Add($tok); $i++");
  lines.push("        }");
  lines.push("");

  lines.push(
    nodesWithConflicts.length > 0
      ? "        $conf = Get-Conflicts $node $used $words.Count $ddWords.Count"
      : "        $conf = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)",
  );
  lines.push("        $handled = $false");
  lines.push(`        if ($pending -ne '') {`);
  lines.push(
    "            $rv = Resolve-FlagVal (Get-FlagVal $node $pending) $cur",
  );
  lines.push(
    "            if ($rv.Dynamic) { $useDynamic = $true } else { $Directive = $rv.Dir; $Values = $rv.Items }",
  );
  lines.push("            $handled = $true");
  lines.push("        }");
  lines.push(
    "        if (-not $handled -and -not $afterDd -and -not $stopped) {",
  );
  lines.push("            if ($IsEqualFlag) {");
  lines.push(`                $inlineHit = ''`);
  lines.push(
    `                if ($Flag.StartsWith('--', [System.StringComparison]::Ordinal)) {`,
  );
  lines.push("                    $fl = Get-LongFlag $node $Flag.Substring(2)");
  lines.push(
    "                    if ($null -ne $fl -and $fl.Inline) { $inlineHit = $fl.Name }",
  );
  lines.push("                } elseif ($Flag.Length -ge 2) {");
  lines.push("                    for ($j = 1; $j -lt $Flag.Length; $j++) {");
  lines.push(
    "                        $fl = Get-ShortFlag $node ([string]$Flag[$j])",
  );
  lines.push("                        if ($null -ne $fl -and $fl.Inline) {");
  lines.push(
    "                            if ($j -eq $Flag.Length - 1) { $inlineHit = $fl.Name }",
  );
  lines.push("                            break");
  lines.push("                        }");
  lines.push("                    }");
  lines.push("                }");
  lines.push(`                if ($inlineHit -ne '') {`);
  lines.push(
    "                    $rv = Resolve-FlagVal (Get-FlagVal $node $inlineHit) $MatchCur",
  );
  lines.push(
    "                    if ($rv.Dynamic) { $useDynamic = $true } else { $Directive = $rv.Dir; $Values = $rv.Items }",
  );
  lines.push("                    $handled = $true");
  lines.push("                }");
  lines.push("            }");
  lines.push(
    `            if (-not $handled -and $cur.StartsWith('-', [System.StringComparison]::Ordinal)) {`,
  );
  lines.push(
    `                $Values = Filter-Items (Get-Flags $node $cur $used $conf) '' $cur $false`,
  );
  lines.push("                $Directive = $ShellCompDirectiveNoFileComp");
  lines.push("                $handled = $true");
  lines.push("            }");
  lines.push("        }");
  if (helpNode) {
    lines.push(`        if (-not $handled -and $node -eq ${helpNode.id}) {`);
    lines.push("            $hnode = 0; $hmiss = $false");
    lines.push(
      "            foreach ($w in $words) { $hn = Get-Transition $hnode $w; if ($hn -lt 0) { $hmiss = $true; break }; $hnode = $hn }",
    );
    lines.push(
      `            if (-not $hmiss) { $Values = Filter-Items (Get-Subcmds $hnode $false) '' $cur $false }`,
    );
    lines.push("            $Directive = $ShellCompDirectiveNoFileComp");
    lines.push("            $handled = $true");
    lines.push("        }");
  }
  lines.push("        if (-not $handled) {");
  lines.push(
    "            $subs = if (-not $afterDd -and $words.Count -eq 0) { Get-Subcmds $node ($cur.Length -gt 0) } else { @() }",
  );
  if (disabledNodes.length > 0) {
    const dList = disabledNodes.map((n) => n.id).join(", ");
    lines.push(`            if ($node -in @(${dList})) {`);
    lines.push(`                $Values = Filter-Items $subs '' $cur $false`);
    lines.push("                $Directive = $ShellCompDirectiveNoFileComp");
    lines.push("                $handled = $true");
    lines.push("            }");
  }
  lines.push("            if (-not $handled) {");
  lines.push(
    "                $pv = Get-PosVal $node $afterDd $words.Count $ddWords.Count $conf",
  );
  lines.push(
    `                if ($pv.Kind -eq 'dynamic') { $useDynamic = $true }`,
  );
  lines.push(`                elseif ($pv.Kind -eq 'none') {`);
  lines.push(`                    $Values = Filter-Items $subs '' $cur $false`);
  lines.push("                    $Directive = $ShellCompDirectiveNoFileComp");
  lines.push("                } else {");
  lines.push("                    $Directive = [int]$pv.Dir");
  lines.push(
    "                    $skip = (($Directive -band ($ShellCompDirectiveFilterFileExt -bor $ShellCompDirectiveFilterDirs)) -ne 0)",
  );
  lines.push(
    `                    $Values = Filter-Items (@($subs) + @($pv.Items)) '' $cur $skip`,
  );
  lines.push("                }");
  lines.push("            }");
  lines.push("        }");
  lines.push("    }");
  lines.push("");

  if (hasDynamic) {
    lines.push("    if ($useDynamic) {");
    lines.push("        $reqArgs = @($prior.ToArray()) + @($cur)");
    lines.push(`        $Out = & ${bin} complete '--' @reqArgs 2>$null`);
    lines.push("        if (-not $Out) { return }");
    lines.push("        $OutArr = @($Out)");
    lines.push(`        [int]$Directive = $OutArr[-1].TrimStart(':')`);
    lines.push(
      "        $OutArr = if ($OutArr.Count -gt 1) { $OutArr[0..($OutArr.Count - 2)] } else { @() }",
    );
    lines.push("        [Array]$Values = $OutArr | ForEach-Object {");
    lines.push(`            $ItemName, $Description = $_.Split("\`t", 2)`);
    lines.push(`            if (-not $Description) { $Description = ' ' }`);
    lines.push(
      `            @{ Name = "$ItemName"; Description = "$Description" }`,
    );
    lines.push("        }");
    lines.push(
      "        if ((($Directive -band ($ShellCompDirectiveFilterFileExt -bor $ShellCompDirectiveFilterDirs)) -eq 0)) {",
    );
    lines.push(
      "            $Values = @($Values | Where-Object { $_.Name.StartsWith($MatchCur, [System.StringComparison]::Ordinal) })",
    );
    lines.push("        }");
    lines.push("    }");
    lines.push("");
  }

  lines.push(
    "    if (($Directive -band $ShellCompDirectiveError) -ne 0) { return }",
  );
  lines.push(
    "    if ((($Directive -band $ShellCompDirectiveFilterFileExt) -ne 0) -or",
  );
  lines.push(
    "        (($Directive -band $ShellCompDirectiveFilterDirs) -ne 0)) {",
  );
  lines.push(
    "        $isDirOnly = (($Directive -band $ShellCompDirectiveFilterDirs) -ne 0)",
  );
  lines.push(
    `        $exts = @($Values | ForEach-Object { ".$($_.Name.TrimStart('.'))" })`,
  );
  lines.push(
    `        $sepIdx = $MatchCur.LastIndexOfAny([char[]]@('/', '\\'))`,
  );
  lines.push(
    `        $dirPrefix = if ($sepIdx -ge 0) { $MatchCur.Substring(0, $sepIdx + 1) } else { '' }`,
  );
  lines.push(
    "        $basePrefix = if ($sepIdx -ge 0) { $MatchCur.Substring($sepIdx + 1) } else { $MatchCur }",
  );
  lines.push(
    `        $searchDir = if ($dirPrefix -ne '') { $dirPrefix } else { '.' }`,
  );
  lines.push(
    "        if (Test-Path -LiteralPath $searchDir -PathType Container) {",
  );
  lines.push(
    "            $entries = Get-ChildItem -LiteralPath $searchDir -ErrorAction SilentlyContinue | Where-Object {",
  );
  lines.push(
    "                $_.Name.StartsWith($basePrefix, [System.StringComparison]::OrdinalIgnoreCase) -and (",
  );
  lines.push(
    "                    $_.PSIsContainer -or (-not $isDirOnly -and ($exts -contains $_.Extension))",
  );
  lines.push("                )");
  lines.push("            }");
  lines.push("            foreach ($entry in $entries) {");
  lines.push(
    `                $rel = "$dirPrefix$($entry.Name)" + $(if ($entry.PSIsContainer) { '/' } else { '' })`,
  );
  lines.push(
    `                $full = if ($IsEqualFlag) { "$Flag=$rel" } else { $rel }`,
  );
  lines.push(
    `                $sp = if ($entry.PSIsContainer) { '' } else { ' ' }`,
  );
  lines.push(
    "                [System.Management.Automation.CompletionResult]::new(",
  );
  lines.push(
    `                    ($full | ${p}_escapeStringWithSpecialChars) + $sp,`,
  );
  lines.push("                    $rel,");
  lines.push(`                    'ParameterValue',`);
  lines.push(
    `                    $(if ($entry.PSIsContainer) { 'Directory' } else { 'File' })`,
  );
  lines.push("                )");
  lines.push("            }");
  lines.push("        }");
  lines.push("        return");
  lines.push("    }");
  lines.push("");
  lines.push("    if ($IsEqualFlag) {");
  lines.push(
    `        $Values = @($Values | ForEach-Object { @{ Name = "$Flag=$($_.Name)"; Description = $_.Description } })`,
  );
  lines.push("    }");
  lines.push("");
  lines.push(
    `    $Space = if (($Directive -band $ShellCompDirectiveNoSpace) -ne 0) { '' } else { ' ' }`,
  );
  lines.push(
    "    if (($Directive -band $ShellCompDirectiveKeepOrder) -eq 0) {",
  );
  lines.push("        $Values = @($Values | Sort-Object -Property Name)");
  lines.push("    }");
  lines.push("");
  lines.push(
    "    if (($Directive -band $ShellCompDirectiveNoFileComp) -ne 0 -and $Values.Length -eq 0) {",
  );
  lines.push(`        ''`);
  lines.push("        return");
  lines.push("    }");
  lines.push("");
  lines.push("    $Values | ForEach-Object {");
  lines.push("        [System.Management.Automation.CompletionResult]::new(");
  lines.push(
    `            ($_.Name | ${p}_escapeStringWithSpecialChars) + $Space,`,
  );
  lines.push("            $_.Name,");
  lines.push(`            'ParameterValue',`);
  lines.push("            $_.Description");
  lines.push("        )");
  lines.push("    }");
  lines.push("}");
  lines.push("");
  lines.push(
    `Register-ArgumentCompleter -CommandName ${psQuote(name)} -ScriptBlock $${p}CompleterBlock`,
  );

  return lines.join("\n");
}
