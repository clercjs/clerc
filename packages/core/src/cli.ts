import type { ParsedResult } from "@clerc/parser";
import { parse } from "@clerc/parser";
import type { LiteralUnion } from "@clerc/utils";
import { toArray } from "@clerc/utils";
import { LiteEmit } from "lite-emit";

import { resolveCommand } from "./command";
import {
  InvalidCommandError,
  MissingRequiredFlagError,
  MissingRequiredMetadataError,
  NoCommandSpecifiedError,
  NoSuchCommandError,
} from "./errors";
import { compose } from "./interceptor";
import { getParametersToResolve, parseParameters } from "./parameter";
import { platformArgv } from "./platform";
import type {
  BaseContext,
  ClercFlagDefinitionValue,
  ClercFlagsDefinition,
  Command,
  CommandHandler,
  CommandOptions,
  CommandWithHandler,
  CommandsMap,
  CommandsRecord,
  ContextStore,
  ErrorHandler,
  Interceptor,
  MakeEmitterEvents,
  ParameterDefinitionValue,
  Plugin,
} from "./types";

export interface CreateOptions {
  name?: string;
  scriptName?: string;
  description?: string;
  version?: string;
}

export interface ParseOptions<Run extends boolean = true> {
  argv?: string[];
  run?: Run;
}

export class Clerc<
  Commands extends CommandsRecord = {},
  GlobalFlags extends ClercFlagsDefinition = {},
> {
  #argv: string[] = [];
  #commands: CommandsMap = new Map();
  #emitter = new LiteEmit<MakeEmitterEvents<Commands, GlobalFlags>>();

  #globalFlags = {} as GlobalFlags;
  #store = {} as Partial<ContextStore>;
  #interceptors: Interceptor<Command, GlobalFlags>[] = [];
  #errorHandlers: ErrorHandler[] = [];
  #name = "";
  #scriptName = "";
  #description = "";
  #version = "";

  private constructor({
    name,
    scriptName,
    description,
    version,
  }: CreateOptions = {}) {
    if (name) {
      this.#name = name;
    }
    if (scriptName) {
      this.#scriptName = scriptName;
    }
    if (description) {
      this.#description = description;
    }
    if (version) {
      this.#version = version;
    }
  }

  public get _name(): string {
    return this.#name || this.#scriptName;
  }

  public get _scriptName(): string {
    return this.#scriptName;
  }

  public get _description(): string {
    return this.#description;
  }

  public get _version(): string {
    return this.#version;
  }

  public get _commands(): CommandsMap {
    return this.#commands;
  }

  public get _globalFlags(): GlobalFlags {
    return this.#globalFlags;
  }

  public get store(): Partial<ContextStore> {
    return this.#store;
  }

  public static create(options?: CreateOptions): Clerc {
    return new Clerc(options);
  }

  public name(name: string): this {
    this.#name = name;

    return this;
  }

  public scriptName(scriptName: string): this {
    this.#scriptName = scriptName;

    return this;
  }

  public description(description: string): this {
    this.#description = description;

    return this;
  }

  public version(version: string): this {
    this.#version = version;

    return this;
  }

  public use(plugin: Plugin): this {
    plugin.setup(this as any);

    return this;
  }

  public errorHandler(handler: ErrorHandler): this {
    this.#errorHandlers.push(handler);

    return this;
  }

  #handleError(error: unknown) {
    if (this.#errorHandlers.length > 0) {
      for (const callback of this.#errorHandlers) {
        callback(error);
      }
    } else {
      throw error;
    }
  }

  #callWithErrorHandler<T>(fn: () => T): T {
    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.catch((error) => {
          this.#handleError(error);
        }) as T;
      }

      return result;
    } catch (error) {
      this.#handleError(error);

      throw error; // This will never be reached, but TypeScript needs it.
    }
  }

  #validateCommandNameAndAlias(name: string, aliases: string[]) {
    if (this.#commands.has(name)) {
      throw new InvalidCommandError(
        `Command with name "${name}" already exists.`,
      );
    }
    for (const alias of aliases) {
      if (this.#commands.has(alias)) {
        throw new InvalidCommandError(
          `Command with name "${alias}" already exists.`,
        );
      }
    }
  }

  public command(commands: readonly CommandWithHandler<any, any, any>[]): this;
  public command<
    Name extends string,
    const Parameters extends readonly ParameterDefinitionValue[],
    Flags extends ClercFlagsDefinition,
  >(
    command: CommandWithHandler<Name, Parameters, Flags>,
  ): Clerc<
    Commands & Record<string, CommandWithHandler<Name, Parameters, Flags>>,
    GlobalFlags
  >;
  public command<
    Name extends string,
    const Parameters extends readonly ParameterDefinitionValue[],
    Flags extends ClercFlagsDefinition,
  >(
    name: Name extends keyof Commands
      ? // type info
        ["COMMAND ALREADY EXISTS"]
      : Name,
    options?: CommandOptions<Parameters, Flags>,
  ): Clerc<
    Commands & Record<Name, Command<Name, Parameters, Flags>>,
    GlobalFlags
  >;
  public command<
    Name extends string,
    const Parameters extends readonly ParameterDefinitionValue[],
    Flags extends ClercFlagsDefinition,
  >(
    name: Name extends keyof Commands
      ? // type info
        ["COMMAND ALREADY EXISTS"]
      : Name,
    description: string,
    options?: CommandOptions<Parameters, Flags>,
  ): Clerc<
    Commands & Record<Name, Command<Name, Parameters, Flags>>,
    GlobalFlags
  >;
  public command(
    nameOrCommandObjectOrCommandArray: any,
    descriptionOrOptions?: any,
    options?: any,
  ): any {
    if (Array.isArray(nameOrCommandObjectOrCommandArray)) {
      for (const command of nameOrCommandObjectOrCommandArray) {
        this.command(command);
      }

      return this;
    }
    const isDescription = typeof descriptionOrOptions === "string";
    const command =
      typeof nameOrCommandObjectOrCommandArray === "string"
        ? {
            name: nameOrCommandObjectOrCommandArray,
            description: isDescription ? descriptionOrOptions : undefined,
            ...(isDescription ? options : descriptionOrOptions),
          }
        : nameOrCommandObjectOrCommandArray;

    const aliases = toArray(command?.alias ?? []);

    this.#callWithErrorHandler(() =>
      this.#validateCommandNameAndAlias(command.name, aliases),
    );

    this.#commands.set(command.name, command);
    for (const alias of aliases) {
      this.#commands.set(alias, { ...command, __isAlias: true });
    }

    if (command.handler) {
      this.on(command.name, command.handler);
    }

    return this as any;
  }

  public globalFlag<Name extends string, Flag extends ClercFlagDefinitionValue>(
    name: Name,
    description: string,
    options: Flag,
  ): Clerc<Commands, GlobalFlags & Record<Name, Flag>>;
  public globalFlag<Name extends string, Flag extends ClercFlagDefinitionValue>(
    name: Name,
    options: Flag,
  ): Clerc<Commands, GlobalFlags & Record<Name, Flag>>;
  public globalFlag(
    name: string,
    descriptionOrOptions: any,
    options?: any,
  ): any {
    const isDescription = typeof descriptionOrOptions === "string";
    // @ts-expect-error
    this.#globalFlags[name] = {
      description: isDescription ? descriptionOrOptions : undefined,
      ...(isDescription ? options : descriptionOrOptions),
    };

    return this as any;
  }

  public interceptor(interceptor: Interceptor<Command, GlobalFlags>): this {
    this.#interceptors.push(interceptor);

    return this;
  }

  public on<Name extends LiteralUnion<keyof Commands, string>>(
    name: Name,
    handler: CommandHandler<Commands[Name], GlobalFlags>,
  ): this {
    this.#emitter.on(name, handler);

    return this;
  }

  #validate() {
    if (!this.#scriptName) {
      throw new MissingRequiredMetadataError("script name");
    }
    if (!this.#version) {
      throw new MissingRequiredMetadataError("version");
    }
  }

  #parseArgv(argv: string[], command?: Command): ParsedResult<any> {
    const { flags, ignore } = command ?? {};

    const parsed = this.#callWithErrorHandler(() =>
      parse(argv, {
        flags: {
          ...this.#globalFlags,
          ...flags,
        },
        ignore,
      }),
    );

    return parsed;
  }

  public async run(): Promise<void> {
    const parametersToResolve = getParametersToResolve(this.#argv);

    const [command, calledAs] = resolveCommand(
      this.#commands,
      parametersToResolve,
    );

    const argvToPass =
      command && calledAs.length > 0
        ? this.#argv.slice(calledAs.split(" ").length)
        : this.#argv;

    const parsed = this.#callWithErrorHandler(() =>
      this.#parseArgv(argvToPass, command),
    );

    let parameters = {};
    let parametersError: Error | undefined;
    try {
      parameters = command?.parameters
        ? parseParameters(
            command.parameters,
            parsed.parameters,
            parsed.doubleDash,
          )
        : {};
    } catch (e) {
      parametersError = e as Error;
    }

    const context: BaseContext<Command, GlobalFlags> = {
      command,
      calledAs,
      parameters,
      flags: parsed.flags,
      ignored: parsed.ignored,
      rawParsed: parsed,
      store: { ...this.#store },
    };

    const emitInterceptor: Interceptor = {
      enforce: "post",
      handler: async (ctx) => {
        if (parsed.missingRequiredFlags.length > 0) {
          throw new MissingRequiredFlagError(parsed.missingRequiredFlags);
        }
        if (parametersError) {
          throw parametersError;
        }
        if (command) {
          await this.#emitter.emit(command.name, ctx as any);
        } else {
          throw parametersToResolve.length > 0
            ? new NoSuchCommandError(parametersToResolve.join(" "))
            : new NoCommandSpecifiedError();
        }
      },
    };

    const composedInterceptor = compose([
      ...this.#interceptors,
      emitInterceptor,
    ]);

    return this.#callWithErrorHandler(() =>
      composedInterceptor(context as any),
    );
  }

  public parse<Run extends boolean = true>(
    argvOrOptions: string[] | ParseOptions<Run> = platformArgv,
  ): Run extends true ? Promise<void> : this {
    this.#callWithErrorHandler(() => this.#validate());

    if (Array.isArray(argvOrOptions)) {
      argvOrOptions = { argv: argvOrOptions };
    }

    const { argv = platformArgv, run = true } = argvOrOptions;

    this.#argv = argv;

    if (run) {
      return this.run() as any;
    }

    return this as any;
  }
}
