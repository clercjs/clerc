import {
  InvalidSchemaError,
  MissingRequiredArgumentError,
  UnexpectedArgumentError,
} from "./errors";
import { DOUBLE_DASH } from "./parser";
import type {
  ArrayConstraintOptions,
  DefaultValue,
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
import type { CompletionOption } from "./types";
import type { CamelCase, Prettify } from "./utils";
import { camelCase, evaluateDefault } from "./utils";

export interface ArgCustomMeta {}
export type ArgMeta = ArgCustomMeta & Record<string, unknown>;

interface ArgSharedMeta extends ArrayConstraintOptions {
  readonly description?: string;
  readonly env?: string;
  readonly complete?: CompletionOption;
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
> = Token extends `<${infer Name}...>` | `[${infer Name}...]`
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

const ARG_TOKEN_REGEX = /^(?:<([\w-]+)(\.\.\.)?>|\[([\w-]+)(\.\.\.)?\])$/;

const isArgToken = (token: string): boolean =>
  token === DOUBLE_DASH || token.startsWith("<") || token.startsWith("[");

const defaultStringJsonSchema = (): Record<string, unknown> => ({
  type: "string",
});

interface CompiledArgItem extends ArgDescriptor {
  readonly convert?: TypeConverter;
}

export interface CompiledArgs {
  readonly descriptors: readonly ArgDescriptor[];
  readonly main: readonly CompiledArgItem[];
  readonly doubleDash: readonly CompiledArgItem[];
  readonly hasDoubleDashSpec: boolean;
}

export function parseCommandSpec(spec: string): {
  readonly name: string;
  readonly argTokens: readonly string[];
} {
  const trimmed = spec.trim();
  if (!trimmed) {
    throw new InvalidSchemaError(
      "command spec cannot be empty; pass run() directly to cli({ ... }) to register a root command",
    );
  }

  const nameTokens: string[] = [];
  const argTokens: string[] = [];

  for (const token of trimmed.split(/\s+/)) {
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

  return { name: nameTokens.join(" "), argTokens };
}

function compileArgSlice(
  tokens: readonly string[],
  argDefs: Readonly<Record<string, ArgDefinitionValue>> | undefined,
  afterDoubleDash: boolean,
  seen: Set<string>,
): CompiledArgItem[] {
  const items: CompiledArgItem[] = [];
  let hasOptional = false;

  for (const [i, token] of tokens.entries()) {
    const match = ARG_TOKEN_REGEX.exec(token);
    if (!match) {
      throw new InvalidSchemaError(`invalid argument definition: ${token}`);
    }
    const rawName = match[1] ?? match[3];
    const name = camelCase(rawName);
    const isRequired = match[1] !== undefined;
    const isVariadic = Boolean(match[2] ?? match[4]);

    if (seen.has(name)) {
      throw new InvalidSchemaError(`duplicate argument name: ${name}`);
    }
    seen.add(name);

    if (isVariadic && i !== tokens.length - 1) {
      throw new InvalidSchemaError(
        "variadic argument must be the last argument in the signature",
      );
    }
    if (isRequired && hasOptional) {
      throw new InvalidSchemaError(
        `required argument "${name}" cannot appear after an optional argument`,
      );
    }
    hasOptional ||= !isRequired;

    const def = argDefs?.[name];
    const norm: ArgOptions | undefined =
      typeof def === "function" || isStandardSchema(def)
        ? { type: def as SingleType }
        : (def as ArgOptions | undefined);

    if (isRequired && norm?.default !== undefined) {
      throw new InvalidSchemaError(
        `required argument "${name}" cannot have a default value`,
      );
    }
    if (norm) {
      validateArraySchemaOptions(`Argument "${name}"`, isVariadic, norm);
    }

    const typeDesc = norm?.type ? describeType(norm.type) : undefined;
    const itemJsonSchema = typeDesc
      ? typeDesc.toJsonSchema
      : defaultStringJsonSchema;
    items.push({
      name,
      rawName,
      token,
      isRequired,
      isVariadic,
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
      toJsonSchema: isVariadic
        ? () =>
            withArrayJsonSchema(
              { type: "array", items: itemJsonSchema() },
              norm ?? {},
            )
        : itemJsonSchema,
      convert: typeDesc?.convert,
    });
  }

  return items;
}

export function compileArgs(
  argTokens: readonly string[],
  argDefs?: Readonly<Record<string, ArgDefinitionValue>>,
): CompiledArgs {
  const ddIdx = argTokens.indexOf(DOUBLE_DASH);
  const mainTokens = ddIdx === -1 ? argTokens : argTokens.slice(0, ddIdx);
  const ddTokens = ddIdx === -1 ? [] : argTokens.slice(ddIdx + 1);

  const seen = new Set<string>();
  const main = compileArgSlice(mainTokens, argDefs, false, seen);
  const doubleDash = compileArgSlice(ddTokens, argDefs, true, seen);

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
    descriptors: [...main, ...doubleDash],
    main,
    doubleDash,
    hasDoubleDashSpec: ddIdx !== -1,
  };
}

async function applyArgSlice(
  items: readonly CompiledArgItem[],
  values: readonly string[],
  result: Record<string, unknown>,
  provided: Set<string>,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  if (!items.some((item) => item.isVariadic) && values.length > items.length) {
    throw new UnexpectedArgumentError(values.slice(items.length));
  }

  for (const [i, item] of items.entries()) {
    const raw = item.isVariadic ? values.slice(i) : values[i];
    const hasCliValue = item.isVariadic
      ? (raw as string[]).length > 0
      : raw !== undefined;

    if (hasCliValue) {
      provided.add(item.name);
      result[item.name] = Array.isArray(raw)
        ? await convertItemList(item.convert, item.token, raw, item)
        : item.convert
          ? await item.convert(raw, item.token)
          : raw;

      continue;
    }

    const envValue = item.env ? env[item.env] : undefined;
    if (envValue !== undefined && envValue !== "") {
      provided.add(item.name);
      result[item.name] = item.isVariadic
        ? await convertItemList(
            item.convert,
            item.token,
            envValue.split(",").map((s) => s.trim()),
            item,
          )
        : item.convert
          ? await item.convert(envValue, item.token)
          : envValue;

      continue;
    }

    if (item.default !== undefined) {
      result[item.name] = evaluateDefault(item.default);
    } else if (item.isRequired) {
      throw new MissingRequiredArgumentError(
        item.rawName,
        item.isVariadic,
        item.env ? [`provide '${item.token}' or set ${item.env}`] : undefined,
      );
    } else {
      result[item.name] = item.isVariadic ? [] : undefined;
    }
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
  const args: Record<string, unknown> = {};
  const provided = new Set<string>();
  const mainValues =
    !compiled.hasDoubleDashSpec && doubleDashValues.length > 0
      ? [...values, ...doubleDashValues]
      : values;

  await applyArgSlice(compiled.main, mainValues, args, provided, env);
  if (compiled.doubleDash.length > 0) {
    await applyArgSlice(
      compiled.doubleDash,
      doubleDashValues,
      args,
      provided,
      env,
    );
  }

  return { args, provided };
}
