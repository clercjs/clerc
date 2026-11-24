import type { ArgDescriptor } from "./args";
import { InvalidSchemaError, RuleError } from "./errors";
import type { FlagDescriptor } from "./flags";
import type { Terminal } from "./terminal";
import type { MaybeArray } from "./utils";
import { formatFlagName, joinList, toArray } from "./utils";

interface NamedRef<Kind extends string, Name extends string = string> {
  readonly kind: Kind;
  readonly name: Name;
}

export type FlagRef<Name extends string = string> = NamedRef<"flag", Name>;
export type ArgRef<Name extends string = string> = NamedRef<"arg", Name>;
export type GroupRef<Name extends string = string> = NamedRef<"group", Name>;

export type RuleRef<
  FlagName extends string = string,
  ArgName extends string = string,
> = FlagRef<FlagName> | ArgRef<ArgName>;

export type RuleTarget<
  FlagName extends string = string,
  ArgName extends string = string,
> = RuleRef<FlagName, ArgName> | GroupRef;

export type MultiRuleKind = "exclusive" | "oneOf" | "atLeastOne" | "together";

export interface DeclarativeRuleOptions {
  readonly message?: string;
  readonly hints?: readonly string[];
}

interface BaseRuleDescriptor<Target> extends DeclarativeRuleOptions {
  readonly targets: readonly Target[];
  readonly group?: string;
}

export type RuleDescriptor<Target = RuleRef> =
  | (BaseRuleDescriptor<Target> & { readonly kind: MultiRuleKind })
  | (BaseRuleDescriptor<Target> & {
      readonly kind: "requires";
      readonly source: RuleRef;
    });

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

export interface CustomRuleFailure {
  readonly message: string;
  readonly detail?: string;
  readonly hints?: readonly string[];
}

export type CustomRuleResult = void | string | CustomRuleFailure;

export type CustomRuleFn<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (
  ctx: RuleCheckContext<Args, Flags>,
) => CustomRuleResult | Promise<CustomRuleResult>;

export interface CustomRuleDescriptor<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> {
  readonly description: string;
  readonly check: CustomRuleFn<Args, Flags>;
}

export type RuleInput<
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> =
  | RuleDescriptor<RuleTarget>
  | CustomRuleFn<Args, Flags>
  | CustomRuleDescriptor<Args, Flags>;

interface MultiTargetRuleMethod<
  FlagName extends string,
  ArgName extends string,
> {
  (
    group: GroupRef,
    options?: DeclarativeRuleOptions,
  ): RuleDescriptor<RuleTarget>;
  (
    targets: readonly RuleTarget<FlagName, ArgName>[],
    options?: DeclarativeRuleOptions,
  ): RuleDescriptor<RuleTarget>;
  (
    first: RuleTarget<FlagName, ArgName>,
    second: RuleTarget<FlagName, ArgName>,
    ...rest: readonly RuleTarget<FlagName, ArgName>[]
  ): RuleDescriptor<RuleTarget>;
}

export type RuleBuilder<
  FlagName extends string = string,
  ArgName extends string = never,
> = {
  readonly flag: <Name extends FlagName>(name: Name) => FlagRef<Name>;
  readonly group: <Name extends string>(name: Name) => GroupRef<Name>;
  readonly requires: (
    source: RuleRef<FlagName, ArgName>,
    targets: MaybeArray<RuleTarget<FlagName, ArgName>>,
    options?: DeclarativeRuleOptions,
  ) => RuleDescriptor<RuleTarget>;
} & Readonly<Record<MultiRuleKind, MultiTargetRuleMethod<FlagName, ArgName>>> &
  // Omit `arg()` when no positional arguments exist (e.g. global `cli.rules()`
  // or arg-less commands) so IDE autocomplete only offers valid targets.
  ([ArgName] extends [never]
    ? {}
    : { readonly arg: <Name extends ArgName>(name: Name) => ArgRef<Name> });

export type RulesFactory<
  FlagName extends string = string,
  ArgName extends string = never,
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> = (r: RuleBuilder<FlagName, ArgName>) => readonly RuleInput<Args, Flags>[];

export type RulesEntry<
  FlagName extends string = string,
  ArgName extends string = never,
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> =
  | RulesFactory<FlagName, ArgName, Args, Flags>
  | CustomRuleDescriptor<Args, Flags>;

export type RulesInput<
  FlagName extends string = string,
  ArgName extends string = never,
  Args extends Record<string, any> = Record<string, any>,
  Flags extends Record<string, any> = Record<string, any>,
> =
  | RulesFactory<FlagName, ArgName, Args, Flags>
  | readonly RulesEntry<FlagName, ArgName, Args, Flags>[];

export interface CompiledRules {
  readonly declarative: readonly RuleDescriptor[];
  readonly custom: readonly CustomRuleFn[];
  readonly notes: readonly string[];
}

export const EMPTY_RULES: CompiledRules = Object.freeze({
  declarative: Object.freeze([]),
  custom: Object.freeze([]),
  notes: Object.freeze([]),
});

const refKey = (ref: RuleRef): string => `${ref.kind}:${ref.name}`;

const isNamedRef = (value: unknown): value is RuleTarget =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  "name" in value &&
  typeof value.name === "string" &&
  (value.kind === "flag" || value.kind === "arg" || value.kind === "group");

const isRuleRef = (value: unknown): value is RuleRef =>
  isNamedRef(value) && value.kind !== "group";

const isGroupRef = (value: unknown): value is GroupRef =>
  isNamedRef(value) && value.kind === "group";

const isCustomRuleDescriptor = (
  value: unknown,
): value is CustomRuleDescriptor =>
  typeof value === "object" &&
  value !== null &&
  "check" in value &&
  typeof value.check === "function" &&
  "description" in value &&
  typeof value.description === "string";

const makeMultiRule =
  (kind: MultiRuleKind): MultiTargetRuleMethod<string, string> =>
  (...args: readonly unknown[]): RuleDescriptor<RuleTarget> => {
    const first = args[0];
    if (Array.isArray(first)) {
      const opts = args[1] as DeclarativeRuleOptions | undefined;

      return {
        kind,
        targets: first,
        message: opts?.message,
        hints: opts?.hints,
      };
    }
    if (isGroupRef(first) && !isNamedRef(args[1])) {
      const opts = args[1] as DeclarativeRuleOptions | undefined;

      return {
        kind,
        targets: [first],
        message: opts?.message,
        hints: opts?.hints,
      };
    }

    return { kind, targets: args as RuleTarget[] };
  };

const RULE_BUILDER: RuleBuilder<string, string> = {
  flag: (name) => ({ kind: "flag", name }),
  arg: (name) => ({ kind: "arg", name }),
  group: (name) => ({ kind: "group", name }),
  exclusive: makeMultiRule("exclusive"),
  oneOf: makeMultiRule("oneOf"),
  atLeastOne: makeMultiRule("atLeastOne"),
  together: makeMultiRule("together"),
  requires: (source, targets, options) => ({
    kind: "requires",
    source,
    targets: toArray(targets),
    message: options?.message,
    hints: options?.hints,
  }),
};

function validateRef(
  ref: RuleRef,
  validFlags: ReadonlyMap<string, FlagDescriptor>,
  validArgs: ReadonlySet<string>,
): void {
  if (!isRuleRef(ref)) {
    throw new InvalidSchemaError(
      "Rule targets must be created with r.flag(...), r.arg(...), or r.group(...).",
    );
  }
  if (ref.kind === "flag" && !validFlags.has(ref.name)) {
    throw new InvalidSchemaError(`Rule references unknown flag "${ref.name}".`);
  }
  if (ref.kind === "arg" && !validArgs.has(ref.name)) {
    throw new InvalidSchemaError(
      `Rule references unknown argument "${ref.name}".`,
    );
  }
}

function expandTargets(
  rawTargets: readonly RuleTarget[],
  validFlags: ReadonlyMap<string, FlagDescriptor>,
  validArgs: ReadonlySet<string>,
): { readonly targets: RuleRef[]; readonly group?: string } {
  const seen = new Set<string>();
  const targets: RuleRef[] = [];
  function pushUnique(ref: RuleRef): void {
    const key = refKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(ref);
    }
  }

  for (const item of rawTargets) {
    if (isGroupRef(item)) {
      let matched = 0;
      for (const flag of validFlags.values()) {
        if (flag.group === item.name) {
          matched++;
          pushUnique({ kind: "flag", name: flag.name });
        }
      }
      if (matched === 0) {
        throw new InvalidSchemaError(
          `Rule references unknown or empty flag group "${item.name}".`,
        );
      }
    } else {
      validateRef(item, validFlags, validArgs);
      pushUnique(item);
    }
  }

  return {
    targets,
    group:
      rawTargets.length === 1 && isGroupRef(rawTargets[0])
        ? rawTargets[0].name
        : undefined,
  };
}

export function normalizeRulesInput(
  input: RulesInput<any, any, any, any> | undefined,
): readonly RulesEntry<any, any, any, any>[] {
  if (!input) {
    return [];
  }

  return Array.isArray(input)
    ? input
    : [input as RulesEntry<any, any, any, any>];
}

export function compileRules(
  entries: readonly RulesEntry<any, any, any, any>[],
  validFlags: ReadonlyMap<string, FlagDescriptor>,
  validArgs: ReadonlySet<string>,
): CompiledRules {
  if (entries.length === 0) {
    return EMPTY_RULES;
  }

  const declarative: RuleDescriptor[] = [];
  const custom: CustomRuleFn[] = [];
  const notes: string[] = [];

  function registerItem(item: RuleInput): void {
    if (typeof item === "function") {
      custom.push(item);

      return;
    }
    if (isCustomRuleDescriptor(item)) {
      custom.push(item.check);
      notes.push(item.description);

      return;
    }

    const { targets, group } = expandTargets(
      item.targets,
      validFlags,
      validArgs,
    );

    if (item.kind === "requires") {
      validateRef(item.source, validFlags, validArgs);
      if (targets.length === 0) {
        throw new InvalidSchemaError(
          `Rule "requires" for ${item.source.kind} "${item.source.name}" must specify at least one target.`,
        );
      }
      const sourceKey = refKey(item.source);
      if (targets.some((t) => refKey(t) === sourceKey)) {
        throw new InvalidSchemaError(
          `Rule "requires" cannot reference ${item.source.kind} "${item.source.name}" itself.`,
        );
      }
      declarative.push({ ...item, targets, group });

      return;
    }

    const minTargets = item.kind === "atLeastOne" && group ? 1 : 2;
    if (targets.length < minTargets) {
      throw new InvalidSchemaError(
        `Rule "${item.kind}" requires at least ${minTargets} distinct targets.`,
      );
    }
    declarative.push({ ...item, targets, group });
  }

  for (const entry of entries) {
    if (isCustomRuleDescriptor(entry)) {
      registerItem(entry);
    } else {
      for (const item of entry(RULE_BUILDER)) {
        registerItem(item);
      }
    }
  }

  return { declarative, custom, notes };
}

export const formatRuleRef = (
  ref: RuleRef,
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
): string =>
  ref.kind === "flag"
    ? (flagMap.get(ref.name)?.target ?? formatFlagName(ref.name))
    : (argMap.get(ref.name)?.token ?? `<${ref.name}>`);

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
  if (refs.every((r) => r.kind === "flag")) {
    return refs.length > 1 ? "options " : "option ";
  }
  if (refs.every((r) => r.kind === "arg")) {
    return refs.length > 1 ? "arguments " : "argument ";
  }

  return "";
}

function collectEnvHints(
  refs: readonly RuleRef[],
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  mode: "any" | "all",
): string[] {
  const envFlags = refs
    .filter((r): r is FlagRef => r.kind === "flag")
    .map((r) => flagMap.get(r.name))
    .filter((d): d is FlagDescriptor & { readonly env: string } =>
      Boolean(d?.env),
    );
  if (envFlags.length === 0) {
    return [];
  }
  if (mode === "all" || envFlags.length === 1) {
    return envFlags.map((f) => `provide '${f.target}' or set ${f.env}`);
  }

  return [
    `provide ${envFlags.map((f) => `'${f.target}'`).join(" / ")} or set ${envFlags.map((f) => f.env).join(" / ")}`,
  ];
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

  const fmtList = (refs: readonly RuleRef[], conj: "and" | "or" = "and") =>
    formatRefList(refs, flagMap, argMap, conj);

  function throwRule(
    rule: RuleDescriptor,
    defaultMessage: string,
    envRefs?: readonly RuleRef[],
    envMode: "any" | "all" = "any",
  ): never {
    const autoHints = envRefs ? collectEnvHints(envRefs, flagMap, envMode) : [];
    const hints = [...(rule.hints ?? []), ...autoHints];

    throw new RuleError(rule.message ?? defaultMessage, {
      hints: hints.length > 0 ? hints : undefined,
    });
  }

  for (const rule of rules) {
    if (rule.kind === "requires") {
      if (!isProvided(rule.source)) {
        continue;
      }
      const missing = rule.targets.filter((t) => !isProvided(t));
      if (missing.length > 0) {
        const src = `${refKindPrefix([rule.source])}'${formatRuleRef(rule.source, flagMap, argMap)}'`;
        throwRule(
          rule,
          `${src} requires ${fmtList(missing)} to also be provided`,
          missing,
          "all",
        );
      }

      continue;
    }

    const present = rule.targets.filter(isProvided);

    if (
      (rule.kind === "exclusive" || rule.kind === "oneOf") &&
      present.length > 1
    ) {
      throwRule(
        rule,
        `${refKindPrefix(present)}${fmtList(present)} cannot be used together`,
      );
    }

    if (
      (rule.kind === "oneOf" || rule.kind === "atLeastOne") &&
      present.length === 0
    ) {
      const prefix = rule.kind === "oneOf" ? "one of" : "at least one of";
      throwRule(
        rule,
        `${prefix} ${fmtList(rule.targets, "or")} is required`,
        rule.targets,
        "any",
      );
    }

    if (
      rule.kind === "together" &&
      present.length > 0 &&
      present.length < rule.targets.length
    ) {
      const missing = rule.targets.filter((t) => !isProvided(t));
      throwRule(
        rule,
        `${refKindPrefix(rule.targets)}${fmtList(rule.targets)} must be provided together (missing ${fmtList(missing)})`,
        missing,
        "all",
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
    if (typeof result === "object" && result?.message) {
      throw new RuleError(result.message, {
        detail: result.detail,
        hints: result.hints,
      });
    }
  }
}
