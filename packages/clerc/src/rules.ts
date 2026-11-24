import type { ArgDescriptor } from "./args";
import { InvalidSchemaError, RuleError } from "./errors";
import type { FlagDescriptor } from "./flags";
import type { Terminal } from "./terminal";
import type { MaybeArray } from "./utils";
import { formatFlagName, joinList, toArray } from "./utils";

export interface FlagRef<Name extends string = string> {
  readonly kind: "flag";
  readonly name: Name;
}

export interface ArgRef<Name extends string = string> {
  readonly kind: "arg";
  readonly name: Name;
}

export type RuleRef<
  FlagName extends string = string,
  ArgName extends string = string,
> = FlagRef<FlagName> | ArgRef<ArgName>;

export type RuleDescriptor =
  | { readonly kind: "exclusive"; readonly targets: readonly RuleRef[] }
  | { readonly kind: "oneOf"; readonly targets: readonly RuleRef[] }
  | { readonly kind: "atLeastOne"; readonly targets: readonly RuleRef[] }
  | { readonly kind: "together"; readonly targets: readonly RuleRef[] }
  | {
      readonly kind: "requires";
      readonly source: RuleRef;
      readonly targets: readonly RuleRef[];
    };

export interface RuleCheckContext<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> {
  readonly args: Args;
  readonly flags: Flags;
  readonly provided: {
    readonly flags: ReadonlySet<string>;
    readonly args: ReadonlySet<string>;
  };
  readonly terminal: Terminal;
}

export type CustomRuleFn<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (
  ctx: RuleCheckContext<Args, Flags>,
) => void | string | Promise<void | string>;

export type RuleInput<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = RuleDescriptor | CustomRuleFn<Args, Flags>;

export type RuleBuilder<
  FlagName extends string = string,
  ArgName extends string = never,
> = {
  readonly flag: <Name extends FlagName>(name: Name) => FlagRef<Name>;
  readonly exclusive: (
    first: RuleRef<FlagName, ArgName>,
    second: RuleRef<FlagName, ArgName>,
    ...rest: readonly RuleRef<FlagName, ArgName>[]
  ) => RuleDescriptor;
  readonly oneOf: (
    first: RuleRef<FlagName, ArgName>,
    second: RuleRef<FlagName, ArgName>,
    ...rest: readonly RuleRef<FlagName, ArgName>[]
  ) => RuleDescriptor;
  readonly atLeastOne: (
    first: RuleRef<FlagName, ArgName>,
    second: RuleRef<FlagName, ArgName>,
    ...rest: readonly RuleRef<FlagName, ArgName>[]
  ) => RuleDescriptor;
  readonly together: (
    first: RuleRef<FlagName, ArgName>,
    second: RuleRef<FlagName, ArgName>,
    ...rest: readonly RuleRef<FlagName, ArgName>[]
  ) => RuleDescriptor;
  readonly requires: (
    source: RuleRef<FlagName, ArgName>,
    targets: MaybeArray<RuleRef<FlagName, ArgName>>,
  ) => RuleDescriptor;
  // Omit `arg()` when no positional arguments exist (e.g. global `cli.rules()`
  // or arg-less commands) so IDE autocomplete only offers valid targets.
} & ([ArgName] extends [never]
  ? {}
  : {
      readonly arg: <Name extends ArgName>(name: Name) => ArgRef<Name>;
    });

export type RulesFactory<
  FlagName extends string = string,
  ArgName extends string = never,
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (r: RuleBuilder<FlagName, ArgName>) => readonly RuleInput<Args, Flags>[];

export interface CompiledRules {
  readonly declarative: readonly RuleDescriptor[];
  readonly custom: readonly CustomRuleFn[];
}

export const EMPTY_RULES: CompiledRules = Object.freeze({
  declarative: Object.freeze([]),
  custom: Object.freeze([]),
});

const refKey = (ref: RuleRef): string => `${ref.kind}:${ref.name}`;

const isRuleRef = (value: unknown): value is RuleRef =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  "name" in value &&
  (value.kind === "flag" || value.kind === "arg") &&
  typeof value.name === "string";

const createRuleBuilder = <
  FlagName extends string = string,
  ArgName extends string = never,
>(): RuleBuilder<FlagName, ArgName> => ({
  flag: <Name extends FlagName>(name: Name): FlagRef<Name> => ({
    kind: "flag",
    name,
  }),
  arg: <Name extends ArgName>(name: Name) => ({
    kind: "arg",
    name,
  }),
  exclusive: (first, second, ...rest) => ({
    kind: "exclusive",
    targets: [first, second, ...rest],
  }),
  oneOf: (first, second, ...rest) => ({
    kind: "oneOf",
    targets: [first, second, ...rest],
  }),
  atLeastOne: (first, second, ...rest) => ({
    kind: "atLeastOne",
    targets: [first, second, ...rest],
  }),
  together: (first, second, ...rest) => ({
    kind: "together",
    targets: [first, second, ...rest],
  }),
  requires: (source, targets) => ({
    kind: "requires",
    source,
    targets: toArray(targets),
  }),
});

function validateRef(
  ref: RuleRef,
  validFlags: ReadonlySet<string>,
  validArgs: ReadonlySet<string>,
): void {
  if (!isRuleRef(ref)) {
    throw new InvalidSchemaError(
      "Rule targets must be created with r.flag(...) or r.arg(...).",
    );
  }
  if (ref.kind === "flag") {
    if (!validFlags.has(ref.name)) {
      throw new InvalidSchemaError(
        `Rule references unknown flag "${ref.name}".`,
      );
    }

    return;
  }
  if (!validArgs.has(ref.name)) {
    throw new InvalidSchemaError(
      `Rule references unknown argument "${ref.name}".`,
    );
  }
}

function dedupeRefs(
  refs: readonly RuleRef[],
  validFlags: ReadonlySet<string>,
  validArgs: ReadonlySet<string>,
): RuleRef[] {
  const seen = new Set<string>();
  const out: RuleRef[] = [];
  for (const ref of refs) {
    validateRef(ref, validFlags, validArgs);
    const key = refKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  }

  return out;
}

export function compileRules(
  factories: readonly RulesFactory<any, any, any, any>[],
  validFlags: ReadonlySet<string>,
  validArgs: ReadonlySet<string>,
): CompiledRules {
  if (factories.length === 0) {
    return EMPTY_RULES;
  }

  const builder = createRuleBuilder<string, string>();
  const declarative: RuleDescriptor[] = [];
  const custom: CustomRuleFn[] = [];

  for (const factory of factories) {
    for (const item of factory(builder)) {
      if (typeof item === "function") {
        custom.push(item);

        continue;
      }

      if (item.kind === "requires") {
        validateRef(item.source, validFlags, validArgs);
        const targets = dedupeRefs(item.targets, validFlags, validArgs);
        if (targets.length === 0) {
          throw new InvalidSchemaError(
            `Rule "requires" for ${item.source.kind} "${item.source.name}" must specify at least one target.`,
          );
        }
        const sourceKey = refKey(item.source);
        for (const target of targets) {
          if (refKey(target) === sourceKey) {
            throw new InvalidSchemaError(
              `Rule "requires" cannot reference ${item.source.kind} "${item.source.name}" itself.`,
            );
          }
        }
        declarative.push({ kind: "requires", source: item.source, targets });

        continue;
      }

      const targets = dedupeRefs(item.targets, validFlags, validArgs);
      if (targets.length < 2) {
        throw new InvalidSchemaError(
          `Rule "${item.kind}" requires at least 2 distinct targets.`,
        );
      }
      declarative.push({ kind: item.kind, targets });
    }
  }

  return { declarative, custom };
}

function formatRuleRef(
  ref: RuleRef,
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
): string {
  if (ref.kind === "flag") {
    return flagMap.get(ref.name)?.target ?? formatFlagName(ref.name);
  }

  return argMap.get(ref.name)?.token ?? `<${ref.name}>`;
}

const formatRefList = (
  refs: readonly RuleRef[],
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
  conjunction: "and" | "or" = "and",
): string =>
  joinList(
    refs.map((ref) => `'${formatRuleRef(ref, flagMap, argMap)}'`),
    conjunction,
  );

function refKindPrefix(refs: readonly RuleRef[]): string {
  const allFlags = refs.every((r) => r.kind === "flag");
  if (allFlags) {
    return refs.length > 1 ? "options " : "option ";
  }
  const allArgs = refs.every((r) => r.kind === "arg");
  if (allArgs) {
    return refs.length > 1 ? "arguments " : "argument ";
  }

  return "";
}

export function validateDeclarativeRules(
  rules: readonly RuleDescriptor[],
  providedFlags: ReadonlySet<string>,
  providedArgs: ReadonlySet<string>,
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
): void {
  const isProvided = (ref: RuleRef): boolean =>
    ref.kind === "flag"
      ? providedFlags.has(ref.name)
      : providedArgs.has(ref.name);

  for (const rule of rules) {
    if (rule.kind === "requires") {
      if (!isProvided(rule.source)) {
        continue;
      }
      const missing = rule.targets.filter((t) => !isProvided(t));
      if (missing.length > 0) {
        const srcLabel = `${refKindPrefix([rule.source])}'${formatRuleRef(rule.source, flagMap, argMap)}'`;
        const missLabel = formatRefList(missing, flagMap, argMap, "and");

        throw new RuleError(
          `${srcLabel} requires ${missLabel} to also be provided`,
        );
      }

      continue;
    }

    const present = rule.targets.filter(isProvided);

    if (rule.kind === "exclusive") {
      if (present.length > 1) {
        throw new RuleError(
          `${refKindPrefix(present)}${formatRefList(present, flagMap, argMap, "and")} cannot be used together`,
        );
      }
    } else if (rule.kind === "oneOf") {
      if (present.length > 1) {
        throw new RuleError(
          `${refKindPrefix(present)}${formatRefList(present, flagMap, argMap, "and")} cannot be used together`,
        );
      }
      if (present.length === 0) {
        throw new RuleError(
          `one of ${formatRefList(rule.targets, flagMap, argMap, "or")} is required`,
        );
      }
    } else if (rule.kind === "atLeastOne") {
      if (present.length === 0) {
        throw new RuleError(
          `at least one of ${formatRefList(rule.targets, flagMap, argMap, "or")} is required`,
        );
      }
    } else if (
      rule.kind === "together" &&
      present.length > 0 &&
      present.length < rule.targets.length
    ) {
      const missing = rule.targets.filter((t) => !isProvided(t));

      throw new RuleError(
        `${refKindPrefix(rule.targets)}${formatRefList(rule.targets, flagMap, argMap, "and")} must be provided together (missing ${formatRefList(missing, flagMap, argMap, "and")})`,
      );
    }
  }
}

export async function validateCustomRules(
  rules: readonly CustomRuleFn[],
  ctx: RuleCheckContext,
): Promise<void> {
  for (const rule of rules) {
    const result = await rule(ctx);
    if (typeof result === "string" && result.length > 0) {
      throw new RuleError(result);
    }
  }
}

export function formatRuleConstraint(
  rule: RuleDescriptor,
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
): { readonly label: string; readonly text: string } {
  const fmt = (ref: RuleRef) => formatRuleRef(ref, flagMap, argMap);
  if (rule.kind === "requires") {
    return {
      label: "requires",
      text: `${fmt(rule.source)} -> ${rule.targets.map(fmt).join(", ")}`,
    };
  }
  const labels: Record<Exclude<RuleDescriptor["kind"], "requires">, string> = {
    exclusive: "exclusive",
    oneOf: "one of",
    atLeastOne: "at least one",
    together: "together",
  };

  return {
    label: labels[rule.kind],
    text: rule.targets.map(fmt).join(", "),
  };
}
