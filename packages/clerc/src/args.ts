import {
  InvalidSchemaError,
  MissingRequiredArgumentError,
  UnexpectedArgumentError,
} from "./errors";
import type { ArrayConstraintOptions } from "./flags";
import { convertItemList, validateArraySchemaOptions } from "./flags";
import { DOUBLE_DASH } from "./parser";
import type {
  DefaultValue,
  InferSingleType,
  SingleType,
  StrictOptions,
  TypeConverter,
  UnwrapDefault,
} from "./schema";
import { describeType, isStandardSchema } from "./schema";
import type { CompletionHandler } from "./types";
import type { CamelCase, Prettify } from "./utils";
import { camelCase, evaluateDefault } from "./utils";

export interface ArgCustomMeta {}
export type ArgMeta = ArgCustomMeta & Record<string, unknown>;

interface ArgSharedMeta extends ArrayConstraintOptions {
  readonly description?: string;
  readonly env?: string;
  readonly complete?: false | CompletionHandler;
  readonly meta?: ArgMeta;
}

export interface ArgDescriptor extends ArgSharedMeta {
  readonly name: string;
  readonly rawName: string;
  readonly token: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
  readonly afterDoubleDash: boolean;
  readonly display?: string;
  readonly default?: unknown;
  readonly unique: boolean;
  readonly toJsonSchema: () => Record<string, unknown>;
}

export interface ArgOptions<
  T extends SingleType = SingleType,
> extends ArgSharedMeta {
  readonly type?: T;
  readonly default?: DefaultValue;
}

export type ArgDefinitionValue = SingleType | ArgOptions;

type ContextualArgValue<V> = [V] extends [never]
  ? ArgOptions
  : V extends SingleType
    ? V
    : StrictOptions<V, ArgOptions>;

export type ContextualArgs<
  Spec extends string,
  Args extends Partial<Record<ExtractArgNames<Spec>, any>>,
> = {
  readonly [K in keyof Args]: K extends ExtractArgNames<Spec>
    ? ContextualArgValue<Args[K]>
    : never;
} & Partial<Record<Exclude<ExtractArgNames<Spec>, keyof Args>, ArgOptions>>;

type TrimWhitespace<S extends string> = S extends
  | ` ${infer R}`
  | `${infer R} `
  | `\t${infer R}`
  | `${infer R}\t`
  | `\n${infer R}`
  | `${infer R}\n`
  ? TrimWhitespace<R>
  : S;

export type NonEmptySpec<S extends string> = string extends S
  ? S
  : TrimWhitespace<S> extends ""
    ? never
    : S;

type StripVariadic<S extends string> = S extends `${infer Name}...` ? Name : S;

type ExtractSingleArgName<Token extends string> = Token extends
  `<${infer Raw}>` | `[${infer Raw}]`
  ? CamelCase<StripVariadic<Raw>>
  : never;

export type ExtractArgNames<S extends string> =
  S extends `${infer Head} ${infer Rest}`
    ? ExtractSingleArgName<Head> | ExtractArgNames<Rest>
    : ExtractSingleArgName<S>;

type ResolveArgType<
  Name extends string,
  Args extends Partial<Record<string, any>>,
> = Name extends keyof Args
  ? NonNullable<Args[Name]> extends { readonly type: infer T }
    ? [T] extends [undefined]
      ? string
      : InferSingleType<T>
    : NonNullable<Args[Name]> extends SingleType
      ? InferSingleType<NonNullable<Args[Name]>>
      : string
  : string;

type InferArgDefault<
  Name extends string,
  Args extends Partial<Record<string, any>>,
  Fallback,
> = Name extends keyof Args
  ? NonNullable<Args[Name]> extends { readonly default: infer D }
    ? [D] extends [undefined]
      ? Fallback
      : UnwrapDefault<D>
    : Fallback
  : Fallback;

type InferTokenArg<
  Token extends string,
  Args extends Partial<Record<string, any>>,
> = Token extends `<${infer Name}...>`
  ? Record<CamelCase<Name>, ResolveArgType<CamelCase<Name>, Args>[]>
  : Token extends `[${infer Name}...]`
    ? Record<CamelCase<Name>, ResolveArgType<CamelCase<Name>, Args>[]>
    : Token extends `<${infer Name}>`
      ? Record<CamelCase<Name>, ResolveArgType<CamelCase<Name>, Args>>
      : Token extends `[${infer Name}]`
        ? Record<
            CamelCase<Name>,
            | ResolveArgType<CamelCase<Name>, Args>
            | InferArgDefault<CamelCase<Name>, Args, undefined>
          >
        : {};

type InferSpecArgsAcc<
  S extends string,
  Args extends Partial<Record<string, any>>,
> = S extends `${infer Head} ${infer Rest}`
  ? InferTokenArg<Head, Args> & InferSpecArgsAcc<Rest, Args>
  : InferTokenArg<S, Args>;

export type InferCommandArgs<
  Spec extends string,
  Args extends Partial<Record<string, any>> = {},
> = string extends Spec
  ? Record<string, any>
  : Prettify<InferSpecArgsAcc<Spec, Args>>;

const ARG_TOKEN_REGEX = /^(<|\[)([\w-]+)(\.\.\.)?(\]|>)$/;

const isArgToken = (token: string): boolean =>
  token === DOUBLE_DASH || token.startsWith("<") || token.startsWith("[");

const defaultStringJsonSchema = (): Record<string, unknown> => ({
  type: "string",
});

interface ParsedCommandSpec {
  readonly name: string;
  readonly argTokens: readonly string[];
}

interface CompiledArgItem extends ArgDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledArgs {
  readonly descriptors: readonly ArgDescriptor[];
  readonly main: readonly CompiledArgItem[];
  readonly doubleDash: readonly CompiledArgItem[];
  readonly hasDoubleDashSpec: boolean;
}

function normalizeArgValue(arg: ArgDefinitionValue): ArgOptions {
  if (typeof arg === "function" || isStandardSchema(arg)) {
    return { type: arg as SingleType };
  }

  return arg as ArgOptions;
}

function splitArgTokens(argTokens: readonly string[]): {
  readonly main: readonly string[];
  readonly doubleDash: readonly string[];
  readonly hasDoubleDash: boolean;
} {
  const ddIdx = argTokens.indexOf(DOUBLE_DASH);

  return ddIdx === -1
    ? { main: argTokens, doubleDash: [], hasDoubleDash: false }
    : {
        main: argTokens.slice(0, ddIdx),
        doubleDash: argTokens.slice(ddIdx + 1),
        hasDoubleDash: true,
      };
}

function parseArgToken(token: string): {
  readonly name: string;
  readonly rawName: string;
  readonly token: string;
  readonly isRequired: boolean;
  readonly isVariadic: boolean;
} {
  const match = ARG_TOKEN_REGEX.exec(token);
  if (
    !match ||
    (match[1] === "<" && match[4] !== ">") ||
    (match[1] === "[" && match[4] !== "]")
  ) {
    throw new InvalidSchemaError(`invalid argument definition: ${token}`);
  }

  return {
    name: camelCase(match[2]),
    rawName: match[2],
    token,
    isRequired: match[1] === "<",
    isVariadic: Boolean(match[3]),
  };
}

export function parseCommandSpec(spec: string): ParsedCommandSpec {
  const trimmed = spec.trim();
  if (trimmed === "") {
    throw new InvalidSchemaError(
      "command spec cannot be empty; pass options directly to command({ ... }) to register a root command",
    );
  }

  const tokens = trimmed.split(/\s+/);
  const nameTokens: string[] = [];
  const argTokens: string[] = [];

  for (const token of tokens) {
    if (argTokens.length > 0 || isArgToken(token)) {
      if (!isArgToken(token)) {
        throw new InvalidSchemaError(
          `unexpected command segment "${token}" after argument in "${spec}"`,
        );
      }
      argTokens.push(token);
    } else {
      nameTokens.push(token);
    }
  }

  return {
    name: nameTokens.join(" "),
    argTokens,
  };
}

function compileArgSlice(
  tokens: readonly string[],
  argDefs: Readonly<Record<string, ArgDefinitionValue>> | undefined,
  afterDoubleDash: boolean,
  seen: Set<string>,
): CompiledArgItem[] {
  const items: CompiledArgItem[] = [];
  let hasOptional = false;

  for (let i = 0; i < tokens.length; i++) {
    const info = parseArgToken(tokens[i]);

    if (seen.has(info.name)) {
      throw new InvalidSchemaError(`duplicate argument name: ${info.name}`);
    }
    seen.add(info.name);

    if (info.isVariadic && i !== tokens.length - 1) {
      throw new InvalidSchemaError(
        "variadic argument must be the last argument in the signature",
      );
    }
    if (info.isRequired) {
      if (hasOptional) {
        throw new InvalidSchemaError(
          `required argument "${info.name}" cannot appear after an optional argument`,
        );
      }
    } else {
      hasOptional = true;
    }

    const def = argDefs?.[info.name];
    const norm = def ? normalizeArgValue(def) : undefined;
    if (info.isRequired && norm?.default !== undefined) {
      throw new InvalidSchemaError(
        `required argument "${info.name}" cannot have a default value`,
      );
    }
    if (norm) {
      validateArraySchemaOptions(
        `Argument "${info.name}"`,
        info.isVariadic,
        norm,
      );
    }

    const typeDesc = norm?.type ? describeType(norm.type) : undefined;
    items.push({
      ...info,
      afterDoubleDash,
      display: typeDesc?.display,
      description: norm?.description,
      default: norm?.default,
      env: norm?.env,
      unique: Boolean(norm?.unique),
      minItems: norm?.minItems,
      maxItems: norm?.maxItems,
      complete: norm?.complete,
      meta: norm?.meta,
      toJsonSchema: typeDesc ? typeDesc.toJsonSchema : defaultStringJsonSchema,
      convert: typeDesc?.convert,
    });
  }

  return items;
}

export function compileArgs(
  argTokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgs {
  const { main, doubleDash, hasDoubleDash } = splitArgTokens(argTokens);
  const seen = new Set<string>();
  const compiledMain = compileArgSlice(main, argDefs, false, seen);
  const compiledDd = compileArgSlice(doubleDash, argDefs, true, seen);

  if (argDefs) {
    for (const key of Object.keys(argDefs)) {
      if (!seen.has(key)) {
        throw new InvalidSchemaError(
          `argument "${key}" is not defined in command signature`,
        );
      }
    }
  }

  return {
    descriptors: [...compiledMain, ...compiledDd],
    main: compiledMain,
    doubleDash: compiledDd,
    hasDoubleDashSpec: hasDoubleDash,
  };
}

async function convertArgValue(
  item: CompiledArgItem,
  raw: string | readonly string[],
): Promise<unknown> {
  if (Array.isArray(raw)) {
    return convertItemList(item.convert, item.token, raw, item);
  }

  return item.convert ? item.convert(raw as string, item.token) : raw;
}

async function applyArgSlice(
  items: readonly CompiledArgItem[],
  values: readonly string[],
  result: Record<string, unknown>,
  provided: Set<string>,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const hasVariadic = items.some((item) => item.isVariadic);
  if (!hasVariadic && values.length > items.length) {
    throw new UnexpectedArgumentError(values.slice(items.length));
  }

  for (const [i, item] of items.entries()) {
    const raw = item.isVariadic ? values.slice(i) : values[i];
    const isMissing = item.isVariadic
      ? (raw as string[]).length === 0
      : raw === undefined;

    if (!isMissing) {
      provided.add(item.name);
      result[item.name] = await convertArgValue(item, raw);

      continue;
    }

    const envValue = item.env ? env[item.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(item.name);
      result[item.name] = await convertArgValue(
        item,
        item.isVariadic ? envValue.split(",").map((s) => s.trim()) : envValue,
      );

      continue;
    }

    if (item.default !== undefined) {
      result[item.name] = evaluateDefault(item.default);

      continue;
    }

    if (item.isRequired) {
      const hints = item.env
        ? [`provide '${item.token}' or set ${item.env}`]
        : undefined;

      throw new MissingRequiredArgumentError(
        item.rawName,
        item.isVariadic,
        hints,
      );
    }

    result[item.name] = item.isVariadic ? [] : undefined;
  }
}

export async function executeCompiledArgs(
  compiled: CompiledArgs,
  values: readonly string[],
  doubleDashValues: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): Promise<{
  readonly args: Record<string, unknown>;
  readonly provided: Set<string>;
}> {
  const result: Record<string, unknown> = {};
  const provided = new Set<string>();
  if (compiled.doubleDash.length > 0) {
    await applyArgSlice(compiled.main, values, result, provided, env);
    await applyArgSlice(
      compiled.doubleDash,
      doubleDashValues,
      result,
      provided,
      env,
    );
  } else if (compiled.hasDoubleDashSpec) {
    await applyArgSlice(compiled.main, values, result, provided, env);
  } else {
    const combined =
      doubleDashValues.length > 0 ? [...values, ...doubleDashValues] : values;
    await applyArgSlice(compiled.main, combined, result, provided, env);
  }

  return { args: result, provided };
}
