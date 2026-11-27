import {
  ConstraintError,
  InvalidSchemaError,
  MissingFlagValueError,
  MissingRequiredFlagError,
  UnknownFlagError,
  ValidationError,
} from "./errors";
import type { ArgvFlagSpec, InvalidFlagValue } from "./parser";
import {
  IMPLICIT_FLAG_VALUE,
  INVALID_BOOL_MSG,
  parseBooleanLiteral,
} from "./parser";
import type {
  ArrayConstraintOptions,
  CounterSchema,
  DefaultValue,
  FlagKind,
  InferSingleType,
  SingleType,
  StrictOptions,
  TypeConverter,
  UnwrapDefault,
} from "./schema";
import {
  convertItemList,
  describeType,
  isStandardSchema,
  validateArraySchemaOptions,
  withArrayJsonSchema,
} from "./schema";
import { findClosest } from "./suggest";
import type { CompletionOption, GroupDefinition } from "./types";
import type { IsAny, MaybeArray, Prettify } from "./utils";
import {
  evaluateDefault,
  formatFlagName,
  joinList,
  kebabCase,
  toArray,
} from "./utils";

export type { ArrayConstraintOptions };
export interface FlagCustomMeta {}
export type FlagMeta = FlagCustomMeta & Record<string, unknown>;

export const FLAGS_NODE: unique symbol = Symbol.for("clerc.flags");

export type ConstraintKind = "exclusive" | "oneOf" | "atLeastOne" | "together";

export interface ConstraintOptions {
  readonly message?: string;
  readonly hints?: readonly string[];
}

export interface ConstraintBranch {
  readonly flags: readonly string[];
  readonly requiredFlags: readonly string[];
}

export interface FlagConstraint extends ConstraintOptions {
  readonly kind: ConstraintKind;
  readonly flags: readonly string[];
  readonly branches: readonly ConstraintBranch[];
  readonly group?: string;
}

interface FlagSharedMeta extends ArrayConstraintOptions {
  readonly short?: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly delimiter?: string;
  readonly env?: string;
  readonly group?: string;
  readonly deprecated?: boolean | string;
  readonly complete?: CompletionOption;
  readonly meta?: FlagMeta;
}

export interface FlagOptions<
  T extends SingleType = SingleType,
> extends FlagSharedMeta {
  readonly type: T;
  readonly multiple?: boolean;
  readonly aliases?: MaybeArray<string>;
  readonly default?: DefaultValue;
  readonly implicitValue?: DefaultValue;
  readonly required?: boolean;
  readonly negatable?: boolean;
  readonly hidden?: boolean;
}

export type FlagDefinitionValue = FlagOptions | SingleType;
export type FlagsDefinition = Record<string, FlagDefinitionValue>;

export interface FlagsGroupNode<F = any> {
  readonly [FLAGS_NODE]: "group";
  readonly title: string;
  readonly flags: F;
}

export interface FlagsConstraintNode<Out = any> {
  readonly [FLAGS_NODE]: ConstraintKind;
  readonly "branches": readonly FlagsInput[];
  readonly "options"?: ConstraintOptions;
  readonly "~types"?: Out;
}

export type FlagsInput =
  | FlagsDefinition
  | FlagsGroupNode
  | FlagsConstraintNode
  | readonly FlagsInput[];

type ContextualFlagValue<V> = [V] extends [never]
  ? FlagDefinitionValue
  : V extends SingleType
    ? V
    : StrictOptions<V, FlagOptions>;

export type ContextualFlags<Flags extends Record<string, any>> = {
  readonly [K in keyof Flags]: ContextualFlagValue<Flags[K]>;
};

type ValidateTupleItem<V> = [V] extends [never]
  ? FlagsInput
  : typeof FLAGS_NODE extends keyof V
    ? V
    : V extends readonly unknown[]
      ? readonly FlagsInput[]
      : V extends Record<string, any>
        ? ContextualFlags<V>
        : FlagsInput;

type ContextualFlagsMember<K, V, Root> = [V] extends [never]
  ? K extends number | `${number}`
    ? FlagsInput
    : FlagDefinitionValue
  : typeof FLAGS_NODE extends keyof Root
    ? V
    : Root extends readonly unknown[]
      ? number extends Root["length"]
        ? FlagsInput
        : ValidateTupleItem<V>
      : ContextualFlagValue<V>;

export type ValidateFlagsInput<F> = {
  readonly [K in keyof F]: ContextualFlagsMember<K, F[K], NoInfer<F>>;
};

export interface FlagDescriptor extends FlagSharedMeta {
  readonly name: string;
  readonly target: string;
  readonly aliases: readonly string[];
  readonly kind: FlagKind;
  readonly display: string;
  readonly default?: unknown;
  readonly implicitValue?: unknown;
  readonly unique: boolean;
  readonly required: boolean;
  readonly negatable: boolean;
  readonly hidden: boolean;
  readonly toJsonSchema: () => Record<string, unknown>;
}

type InferFlagDefault<T extends FlagDefinitionValue, Fallback> = T extends {
  readonly default: infer D;
}
  ? [D] extends [undefined]
    ? Fallback
    : UnwrapDefault<D>
  : Fallback;

type InferFlagImplicitValue<T extends FlagDefinitionValue> = T extends {
  readonly implicitValue: infer D;
}
  ? [D] extends [undefined]
    ? never
    : UnwrapDefault<D>
  : never;

type IsTypeAny<T extends FlagDefinitionValue> =
  IsAny<T> extends true
    ? true
    : T extends { readonly type: infer Type }
      ? IsAny<Type> extends true
        ? true
        : false
      : false;

type InferSingleFlag<T extends FlagDefinitionValue> =
  IsTypeAny<T> extends true
    ? any
    : T extends CounterSchema | { readonly type: CounterSchema }
      ? number
      : T extends { readonly type: infer Item; readonly multiple: true }
        ? InferSingleType<Item>[]
        : T extends { readonly type: infer Item }
          ? | InferSingleType<Item>
            | InferFlagImplicitValue<T>
            | InferFlagDefault<
                T,
                [InferSingleType<Item>] extends [boolean]
                  ? never
                  : T extends { readonly required: true }
                    ? never
                    : undefined
              >
          : T extends SingleType
            ? | InferSingleType<T>
              | ([InferSingleType<T>] extends [boolean] ? never : undefined)
            : never;

export type InferFlags<T extends Record<string, any>> = Prettify<{
  -readonly [K in keyof T]: T[K] extends FlagDefinitionValue
    ? InferSingleFlag<T[K]>
    : never;
}>;

type SimplifyUnion<T> = T extends unknown
  ? { -readonly [K in keyof T]: T[K] } & {}
  : never;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type KnownKeys<T> = T extends unknown
  ? string extends keyof T
    ? never
    : keyof T
  : never;

export type MergeFlagsTypes<Base, Next> = SimplifyUnion<
  DistributiveOmit<Base, KnownKeys<Next>> & Next
>;

export type MergeFlagsTuple<
  Items extends readonly unknown[],
  Acc = {},
> = Items extends readonly [infer Head, ...infer Tail]
  ? MergeFlagsTuple<Tail, MergeFlagsTypes<Acc, InferFlagsInput<Head>>>
  : Acc;

export type InferFlagsInput<F> =
  F extends FlagsConstraintNode<infer Out>
    ? Out
    : F extends FlagsGroupNode<infer Inner>
      ? InferFlagsInput<Inner>
      : F extends readonly unknown[]
        ? MergeFlagsTuple<F>
        : F extends Record<string, any>
          ? InferFlags<F>
          : {};

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

type AllKeys<T> = T extends unknown ? keyof T : never;

type PropType<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;

type IsSingleKey<T> = [AllKeys<T>] extends [never]
  ? false
  : [UnionToIntersection<AllKeys<T>>] extends [never]
    ? false
    : true;

type PresentValue<V> = [V] extends [boolean] ? true : Exclude<V, undefined>;

type InactiveFlagValue<V> = [V] extends [boolean]
  ? false
  : [V] extends [readonly unknown[]]
    ? V
    : undefined;

type InactiveFlags<T> = {
  -readonly [K in AllKeys<T>]: InactiveFlagValue<PropType<T, K>>;
};

type PresentFlags<T> = {
  -readonly [K in AllKeys<T>]: PresentValue<PropType<T, K>>;
};

type ActiveBranchFlags<Raw> =
  IsSingleKey<Raw> extends true ? PresentFlags<Raw> : Raw;

type RawBranches<Branches extends readonly unknown[]> = {
  readonly [I in keyof Branches]: InferFlagsInput<Branches[I]>;
};

type AllInactiveBranches<RawTuple extends readonly unknown[]> = InactiveFlags<
  RawTuple[number]
>;

type BranchConstituents<
  RawTuple extends readonly unknown[],
  Base = AllInactiveBranches<RawTuple>,
> = {
  readonly [I in keyof RawTuple]: MergeFlagsTypes<
    Base,
    ActiveBranchFlags<RawTuple[I]>
  >;
}[number];

type InferOneOfTuple<Branches extends readonly unknown[]> = SimplifyUnion<
  BranchConstituents<RawBranches<Branches>>
>;

type InferExclusiveTuple<Branches extends readonly unknown[]> = SimplifyUnion<
  | BranchConstituents<RawBranches<Branches>>
  | AllInactiveBranches<RawBranches<Branches>>
>;

type InferTogether<F> = SimplifyUnion<
  PresentFlags<InferFlagsInput<F>> | InactiveFlags<InferFlagsInput<F>>
>;

function isPlainConstraintOptions(value: unknown): value is ConstraintOptions {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    FLAGS_NODE in value
  ) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((k) => k !== "message" && k !== "hints")) {
    return false;
  }
  const rec = value as Record<string, unknown>;
  if (
    "message" in rec &&
    rec.message !== undefined &&
    typeof rec.message !== "string"
  ) {
    return false;
  }
  if ("hints" in rec && rec.hints !== undefined && !Array.isArray(rec.hints)) {
    return false;
  }

  return true;
}

function createMultiBranchConstraint(
  kind: "oneOf" | "exclusive",
  args: readonly unknown[],
): FlagsConstraintNode {
  const last = args.at(-1);
  const hasOpts = args.length >= 3 && isPlainConstraintOptions(last);

  return {
    [FLAGS_NODE]: kind,
    branches: (hasOpts ? args.slice(0, -1) : args) as readonly FlagsInput[],
    options: hasOpts ? last : undefined,
  };
}

export function oneOf<const B1 extends FlagsInput, const B2 extends FlagsInput>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferOneOfTuple<readonly [B1, B2]>>;
export function oneOf<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const B3 extends FlagsInput,
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  third: ValidateFlagsInput<B3>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferOneOfTuple<readonly [B1, B2, B3]>>;
export function oneOf<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const B3 extends FlagsInput,
  const B4 extends FlagsInput,
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  third: ValidateFlagsInput<B3>,
  fourth: ValidateFlagsInput<B4>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferOneOfTuple<readonly [B1, B2, B3, B4]>>;
export function oneOf<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const Rest extends readonly FlagsInput[] = readonly [],
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  ...rest: { readonly [I in keyof Rest]: ValidateFlagsInput<Rest[I]> }
): FlagsConstraintNode<InferOneOfTuple<readonly [B1, B2, ...Rest]>>;
export function oneOf(...args: readonly unknown[]): FlagsConstraintNode {
  return createMultiBranchConstraint("oneOf", args);
}

export function exclusive<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferExclusiveTuple<readonly [B1, B2]>>;
export function exclusive<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const B3 extends FlagsInput,
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  third: ValidateFlagsInput<B3>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferExclusiveTuple<readonly [B1, B2, B3]>>;
export function exclusive<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const B3 extends FlagsInput,
  const B4 extends FlagsInput,
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  third: ValidateFlagsInput<B3>,
  fourth: ValidateFlagsInput<B4>,
  options: ConstraintOptions,
): FlagsConstraintNode<InferExclusiveTuple<readonly [B1, B2, B3, B4]>>;
export function exclusive<
  const B1 extends FlagsInput,
  const B2 extends FlagsInput,
  const Rest extends readonly FlagsInput[] = readonly [],
>(
  first: ValidateFlagsInput<B1>,
  second: ValidateFlagsInput<B2>,
  ...rest: { readonly [I in keyof Rest]: ValidateFlagsInput<Rest[I]> }
): FlagsConstraintNode<InferExclusiveTuple<readonly [B1, B2, ...Rest]>>;
export function exclusive(...args: readonly unknown[]): FlagsConstraintNode {
  return createMultiBranchConstraint("exclusive", args);
}

export const together = <const F extends FlagsInput>(
  flags: ValidateFlagsInput<F>,
  options?: ConstraintOptions,
): FlagsConstraintNode<InferTogether<F>> => ({
  [FLAGS_NODE]: "together",
  branches: [flags as FlagsInput],
  options,
});

export const atLeastOne = <const F extends FlagsInput>(
  flags: ValidateFlagsInput<F>,
  options?: ConstraintOptions,
): FlagsConstraintNode<InferFlagsInput<F>> => ({
  [FLAGS_NODE]: "atLeastOne",
  branches: [flags as FlagsInput],
  options,
});

export const createFlagsGroup = <F extends FlagsInput>(
  title: string,
  flags: F,
): FlagsGroupNode<F> => ({
  [FLAGS_NODE]: "group",
  title,
  flags,
});

export const isFlagsNode = (
  value: unknown,
): value is FlagsGroupNode | FlagsConstraintNode =>
  typeof value === "object" && value !== null && FLAGS_NODE in value;

export interface CompiledFlagEntry extends FlagDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledFlags {
  readonly entries: readonly CompiledFlagEntry[];
  readonly byName: ReadonlyMap<string, CompiledFlagEntry>;
  readonly specs: readonly ArgvFlagSpec[];
  readonly knownNames: readonly string[];
}

export interface CompiledFlagSet {
  readonly flags: CompiledFlags;
  readonly constraints: readonly FlagConstraint[];
  readonly groups: readonly GroupDefinition[];
  readonly declaredNames: ReadonlySet<string>;
}

const normalizeFlagValue = (flag: FlagDefinitionValue): FlagOptions =>
  typeof flag === "function" || isStandardSchema(flag)
    ? { type: flag as SingleType }
    : (flag as FlagOptions);

const implicitDefault = (kind: FlagKind): unknown =>
  kind === "array"
    ? []
    : kind === "boolean"
      ? false
      : kind === "counter"
        ? 0
        : undefined;

export const createBuiltinFlagDescriptor = (
  name: string,
  short: string | undefined,
  description: string,
  kind: "boolean" | "counter" = "boolean",
): FlagDescriptor => ({
  name,
  target: formatFlagName(name),
  short,
  aliases: [],
  kind,
  display: "boolean",
  description,
  unique: false,
  required: false,
  negatable: false,
  hidden: false,
  toJsonSchema: () =>
    kind === "counter" ? { type: "integer", minimum: 0 } : { type: "boolean" },
});

function compileSingleFlagEntry(
  name: string,
  rawDef: FlagDefinitionValue,
  groupTitle: string | undefined,
  suppressGlobalRequired: boolean,
): { readonly entry: CompiledFlagEntry; readonly declaredRequired: boolean } {
  const norm = normalizeFlagValue(rawDef);
  if (norm.required && norm.default !== undefined) {
    throw new InvalidSchemaError(
      `Flag "${name}" cannot be both required and have a default value.`,
    );
  }

  const { kind, display, convert, toJsonSchema } = describeType(
    norm.type,
    Boolean(norm.multiple),
  );
  if (norm.delimiter !== undefined && (kind !== "array" || !norm.delimiter)) {
    throw new InvalidSchemaError(
      `Flag "${name}" delimiter requires a non-empty string on an array flag.`,
    );
  }
  if (norm.implicitValue !== undefined && kind !== "single") {
    throw new InvalidSchemaError(
      `Flag "${name}" implicitValue can only be used with single-value flag types.`,
    );
  }
  validateArraySchemaOptions(`Flag "${name}"`, kind === "array", norm);

  const declaredRequired = Boolean(norm.required);
  const aliases = norm.aliases ? toArray(norm.aliases).map(kebabCase) : [];
  const negatable = kind === "boolean" && norm.negatable !== false;

  return {
    declaredRequired,
    entry: {
      name,
      target: formatFlagName(name),
      short: norm.short,
      aliases,
      kind,
      display,
      description: norm.description,
      placeholder: norm.placeholder,
      default: norm.default,
      implicitValue: norm.implicitValue,
      delimiter: norm.delimiter,
      unique: Boolean(norm.unique),
      minItems: norm.minItems,
      maxItems: norm?.maxItems,
      required: suppressGlobalRequired ? false : declaredRequired,
      env: norm.env,
      negatable,
      group: norm.group ?? groupTitle,
      hidden: Boolean(norm.hidden),
      deprecated: norm.deprecated,
      complete: norm.complete,
      meta: norm.meta,
      toJsonSchema:
        kind === "array" &&
        (norm.unique ||
          norm.minItems !== undefined ||
          norm.maxItems !== undefined)
          ? () => withArrayJsonSchema(toJsonSchema(), norm)
          : toJsonSchema,
      convert,
    },
  };
}

const flagToArgvSpec = (flag: FlagDescriptor): ArgvFlagSpec => ({
  key: flag.name,
  kind: flag.kind,
  short: flag.short,
  aliases: flag.aliases.length > 0 ? flag.aliases : undefined,
  negatable: flag.kind === "boolean" ? flag.negatable : undefined,
  optionalValue: flag.implicitValue !== undefined,
});

export function buildCompiledFlags(
  entries: readonly CompiledFlagEntry[],
): CompiledFlags {
  const byName = new Map<string, CompiledFlagEntry>();
  const specs: ArgvFlagSpec[] = [];
  const knownNames: string[] = [];

  for (const entry of entries) {
    byName.set(entry.name, entry);
    specs.push(flagToArgvSpec(entry));
    knownNames.push(kebabCase(entry.name), ...entry.aliases);
  }

  return { entries, byName, specs, knownNames };
}

export function compileFlagsInputs(
  inputs: readonly (FlagsInput | undefined)[],
): CompiledFlagSet {
  const entryMap = new Map<string, CompiledFlagEntry>();
  const constraints: FlagConstraint[] = [];
  const groups: GroupDefinition[] = [];
  const seenGroups = new Set<string>();

  function ensureGroup(title: string): void {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new InvalidSchemaError("Flag group title cannot be empty.");
    }
    if (!seenGroups.has(title)) {
      seenGroups.add(title);
      groups.push({ key: title, title });
    }
  }

  function walk(
    node: FlagsInput | undefined,
    groupTitle: string | undefined,
    suppressRequired: boolean,
    directGroupTitle?: string,
  ): ConstraintBranch {
    if (!node) {
      return { flags: [], requiredFlags: [] };
    }

    if (Array.isArray(node)) {
      const flags: string[] = [];
      const requiredFlags: string[] = [];
      for (const item of node) {
        const res = walk(item, groupTitle, suppressRequired);
        flags.push(...res.flags);
        requiredFlags.push(...res.requiredFlags);
      }

      return { flags, requiredFlags };
    }

    if (isFlagsNode(node)) {
      if (node[FLAGS_NODE] === "group") {
        ensureGroup(node.title);
        const inner = node.flags as FlagsInput;
        const isDirectConstraint =
          isFlagsNode(inner) && inner[FLAGS_NODE] !== "group";

        return walk(
          inner,
          node.title,
          suppressRequired,
          isDirectConstraint ? node.title : undefined,
        );
      }

      const kind = node[FLAGS_NODE];
      const childSuppress =
        suppressRequired || kind === "oneOf" || kind === "together";

      if (kind === "oneOf" || kind === "exclusive") {
        if (node.branches.length < 2) {
          throw new InvalidSchemaError(
            `Constraint "${kind}" requires at least 2 branches.`,
          );
        }
        const seenInConstraint = new Set<string>();
        const allFlags: string[] = [];
        const allRequired: string[] = [];
        const branches: ConstraintBranch[] = [];

        for (const branchInput of node.branches) {
          const branch = walk(branchInput, groupTitle, childSuppress);
          if (branch.flags.length === 0) {
            throw new InvalidSchemaError(
              `Constraint "${kind}" branch must define at least one flag.`,
            );
          }
          for (const f of branch.flags) {
            if (seenInConstraint.has(f)) {
              throw new InvalidSchemaError(
                `Flag "${f}" appears in multiple branches of "${kind}".`,
              );
            }
            seenInConstraint.add(f);
            allFlags.push(f);
          }
          allRequired.push(...branch.requiredFlags);
          branches.push(branch);
        }

        constraints.push({
          kind,
          flags: allFlags,
          branches,
          group: directGroupTitle,
          message: node.options?.message,
          hints: node.options?.hints,
        });

        return { flags: allFlags, requiredFlags: allRequired };
      }

      const inner = walk(node.branches[0], groupTitle, childSuppress);
      const minFlags = kind === "together" ? 2 : 1;
      if (inner.flags.length < minFlags) {
        throw new InvalidSchemaError(
          `Constraint "${kind}" requires at least ${minFlags} distinct flag${minFlags > 1 ? "s" : ""}.`,
        );
      }
      const uniqueFlags = [...new Set(inner.flags)];
      if (uniqueFlags.length < minFlags) {
        throw new InvalidSchemaError(
          `Constraint "${kind}" requires at least ${minFlags} distinct flags.`,
        );
      }

      constraints.push({
        kind,
        flags: uniqueFlags,
        branches: uniqueFlags.map((f) => ({ flags: [f], requiredFlags: [f] })),
        group: directGroupTitle,
        message: node.options?.message,
        hints: node.options?.hints,
      });

      return { flags: uniqueFlags, requiredFlags: inner.requiredFlags };
    }

    const record = node as FlagsDefinition;
    const flags: string[] = [];
    const requiredFlags: string[] = [];
    for (const name of Object.keys(record)) {
      const { entry, declaredRequired } = compileSingleFlagEntry(
        name,
        record[name],
        groupTitle,
        suppressRequired,
      );
      if (entry.group && !seenGroups.has(entry.group)) {
        seenGroups.add(entry.group);
        groups.push({ key: entry.group, title: entry.group });
      }
      entryMap.set(name, entry);
      flags.push(name);
      if (declaredRequired) {
        requiredFlags.push(name);
      }
    }

    return { flags, requiredFlags };
  }

  for (const input of inputs) {
    walk(input, undefined, false);
  }

  const entries = [...entryMap.values()];

  return {
    flags: buildCompiledFlags(entries),
    constraints,
    groups,
    declaredNames: new Set(entryMap.keys()),
  };
}

async function resolveEnvValue(
  entry: CompiledFlagEntry,
  envValue: string,
): Promise<unknown> {
  switch (entry.kind) {
    case "boolean": {
      const parsed = parseBooleanLiteral(envValue);
      if (parsed === undefined) {
        throw new ValidationError(entry.target, envValue, [
          { message: INVALID_BOOL_MSG },
        ]);
      }

      return parsed;
    }
    case "counter": {
      const trimmed = envValue.trim();
      const count = trimmed === "" ? Number.NaN : Number(trimmed);
      if (Number.isInteger(count) && count >= 0) {
        return count;
      }
      const parsedBool = parseBooleanLiteral(trimmed);
      if (parsedBool !== undefined) {
        return parsedBool ? 1 : 0;
      }

      throw new ValidationError(entry.target, envValue, [
        { message: "expected a non-negative integer or boolean" },
      ]);
    }
    case "array": {
      const delimiter = entry.delimiter ?? ",";

      return convertItemList(
        entry.convert,
        entry.target,
        envValue.split(delimiter).map((s) => s.trim()),
        entry,
      );
    }
    case "single": {
      return entry.convert ? entry.convert(envValue, entry.target) : envValue;
    }
  }
}

export async function resolveCompiledFlags(
  compiled: CompiledFlags,
  rawFlags: Record<string, any>,
  explicitlyProvided: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): Promise<{
  readonly flags: Record<string, any>;
  readonly missingRequired: string[];
  readonly provided: Set<string>;
}> {
  const flags: Record<string, any> = {};
  const missingRequired: string[] = [];
  const provided = new Set<string>(explicitlyProvided);

  for (const entry of compiled.entries) {
    const { name, kind, target, convert } = entry;
    const rawValue = rawFlags[name];

    if (provided.has(name)) {
      if (rawValue === IMPLICIT_FLAG_VALUE) {
        flags[name] = evaluateDefault(entry.implicitValue);
      } else if (kind === "array") {
        const items = entry.delimiter
          ? (rawValue as string[]).flatMap((v) => v.split(entry.delimiter!))
          : (rawValue as string[]);
        flags[name] = await convertItemList(convert, target, items, entry);
      } else {
        flags[name] = convert
          ? await convert(rawValue as string, target)
          : rawValue;
      }

      continue;
    }

    const envValue = entry.env ? env[entry.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(name);
      flags[name] = await resolveEnvValue(entry, envValue);

      continue;
    }

    if (entry.default !== undefined) {
      flags[name] = evaluateDefault(entry.default);

      continue;
    }

    if (entry.required) {
      missingRequired.push(name);

      continue;
    }

    flags[name] = implicitDefault(kind);
  }

  return { flags, missingRequired, provided };
}

export function warnFlagDeprecations(
  compiled: CompiledFlags,
  provided: ReadonlySet<string>,
  warn: (message: string) => void,
): void {
  for (const name of provided) {
    const entry = compiled.byName.get(name);
    if (!entry?.deprecated) {
      continue;
    }
    const reason =
      typeof entry.deprecated === "string" ? `: ${entry.deprecated}` : "";
    warn(`Option '${entry.target}' is deprecated${reason}`);
  }
}

export function validateParsedFlags(
  compiled: CompiledFlags,
  knownFlagNames: readonly string[],
  parsed: {
    readonly unknown: Readonly<Record<string, unknown>>;
    readonly missingValueFlags: readonly string[];
    readonly missingValueCandidates?: Readonly<Record<string, string>>;
    readonly invalidValues: readonly InvalidFlagValue[];
  },
  strictFlags = true,
): void {
  if (parsed.missingValueFlags.length > 0) {
    const hints: string[] = [];
    for (const flag of parsed.missingValueFlags) {
      const candidate = parsed.missingValueCandidates?.[flag];
      if (candidate) {
        const target = compiled.byName.get(flag)!.target;
        hints.push(
          `if '${candidate}' is intended as the value, pass it as '${target}=${candidate}'`,
        );
      }
    }

    throw new MissingFlagValueError(
      parsed.missingValueFlags,
      hints.length > 0 ? hints : undefined,
    );
  }

  if (strictFlags) {
    const unknownKeys = Object.keys(parsed.unknown);
    if (unknownKeys.length > 0) {
      const hints: string[] = [];
      for (const unknown of unknownKeys) {
        if (unknown.length <= 1) {
          continue;
        }
        const suggestion = findClosest(kebabCase(unknown), knownFlagNames, 3);
        if (suggestion) {
          hints.push(
            `a similar option exists: '${formatFlagName(suggestion)}'`,
          );
        }
      }

      throw new UnknownFlagError(unknownKeys, hints);
    }
  }

  const firstInvalid = parsed.invalidValues[0];
  if (firstInvalid) {
    const target = compiled.byName.get(firstInvalid.flag)!.target;

    throw new ValidationError(target, firstInvalid.value, [
      { message: firstInvalid.message },
    ]);
  }
}

export function validateMissingRequiredFlags(
  compiled: CompiledFlags,
  missingRequired: readonly string[],
): void {
  if (missingRequired.length > 0) {
    const hints: string[] = [];
    for (const name of missingRequired) {
      const entry = compiled.byName.get(name);
      if (entry?.env) {
        hints.push(`provide '${entry.target}' or set ${entry.env}`);
      }
    }

    throw new MissingRequiredFlagError(
      missingRequired,
      hints.length > 0 ? hints : undefined,
    );
  }
}

const formatBranchLabel = (
  branch: ConstraintBranch,
  byName: ReadonlyMap<string, CompiledFlagEntry>,
): string =>
  branch.flags
    .map((f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`)
    .join(" + ");

function collectConstraintEnvHints(
  flagNames: readonly string[],
  byName: ReadonlyMap<string, CompiledFlagEntry>,
  conjunction: "and" | "or" = "or",
): string[] {
  const envs: string[] = [];
  for (const name of flagNames) {
    const entry = byName.get(name);
    if (entry?.env && !envs.includes(entry.env)) {
      envs.push(entry.env);
    }
  }

  return envs.length > 0
    ? [`you can also set ${joinList(envs, conjunction)}`]
    : [];
}

export function validateFlagConstraints(
  constraints: readonly FlagConstraint[],
  provided: ReadonlySet<string>,
  byName: ReadonlyMap<string, CompiledFlagEntry>,
): void {
  for (const constraint of constraints) {
    const activeBranches = constraint.branches.filter((b) =>
      b.flags.some((f) => provided.has(f)),
    );

    if (constraint.kind === "exclusive" || constraint.kind === "oneOf") {
      if (activeBranches.length > 1) {
        const labels = activeBranches.map((b) => formatBranchLabel(b, byName));

        throw new ConstraintError(
          constraint.message ??
            `${joinList(labels, "and")} cannot be used together`,
          { hints: constraint.hints },
        );
      }

      if (constraint.kind === "oneOf" && activeBranches.length === 0) {
        const labels = constraint.branches.map((b) =>
          formatBranchLabel(b, byName),
        );
        const envHints = collectConstraintEnvHints(constraint.flags, byName);

        throw new ConstraintError(
          constraint.message ??
            `exactly one of ${joinList(labels, "or")} is required`,
          {
            hints:
              constraint.hints ?? (envHints.length > 0 ? envHints : undefined),
          },
        );
      }

      if (activeBranches.length === 1) {
        const active = activeBranches[0];
        const missingInBranch = active.requiredFlags.filter(
          (f) => !provided.has(f),
        );
        if (missingInBranch.length > 0) {
          const present = active.flags
            .filter((f) => provided.has(f))
            .map((f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`);
          const missing = missingInBranch.map(
            (f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`,
          );

          throw new ConstraintError(
            constraint.message ??
              `${joinList(present, "and")} requires ${joinList(missing, "and")}`,
            {
              hints:
                constraint.hints ??
                collectConstraintEnvHints(missingInBranch, byName, "and"),
            },
          );
        }
      }

      continue;
    }

    if (constraint.kind === "atLeastOne") {
      if (activeBranches.length === 0) {
        const labels = constraint.flags.map(
          (f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`,
        );
        const envHints = collectConstraintEnvHints(constraint.flags, byName);

        throw new ConstraintError(
          constraint.message ??
            (constraint.group
              ? `at least one option in '${constraint.group}' is required (${labels.join(", ")})`
              : `at least one of ${joinList(labels, "or")} is required`),
          {
            hints:
              constraint.hints ?? (envHints.length > 0 ? envHints : undefined),
          },
        );
      }

      continue;
    }

    if (
      constraint.kind === "together" &&
      activeBranches.length > 0 &&
      activeBranches.length < constraint.flags.length
    ) {
      const present = constraint.flags
        .filter((f) => provided.has(f))
        .map((f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`);
      const missingNames = constraint.flags.filter((f) => !provided.has(f));
      const missing = missingNames.map(
        (f) => `'${byName.get(f)?.target ?? formatFlagName(f)}'`,
      );
      const envHints = collectConstraintEnvHints(missingNames, byName, "and");

      throw new ConstraintError(
        constraint.message ??
          `${joinList(present, "and")} requires ${joinList(missing, "and")}`,
        {
          hints:
            constraint.hints ?? (envHints.length > 0 ? envHints : undefined),
        },
      );
    }
  }
}
