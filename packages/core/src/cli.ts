import { LiteEmit } from "lite-emit";
import { typeFlag } from "type-flag";
import type { Dict, LiteralUnion, MaybeArray } from "@clerc/utils";
import { toArray } from "@clerc/utils";

import {
  CommandExistsError,
  DescriptionNotSetError,
  InvalidCommandNameError,
  NameNotSetError,
  NoCommandGivenError,
  NoSuchCommandError,
  VersionNotSetError,
} from "./errors";
import type {
  Command,
  CommandOptions,
  CommandRecord,
  CommandType,
  CommandWithHandler,
  FlagOptions,
  Handler,
  HandlerContext,
  Inspector,
  InspectorContext,
  MakeEventMap,
  Plugin,
} from "./types";
import {
  compose,
  isInvalidName,
  resolveArgv,
  resolveCommand,
  resolveParametersBeforeFlag,
} from "./utils";
import { mapParametersToArguments, parseParameters } from "./parameters";

export const SingleCommand = Symbol("SingleCommand");
export type SingleCommandType = typeof SingleCommand;

export class Clerc<C extends CommandRecord = {}> {
  #name = "";
  #description = "";
  #version = "";
  #inspectors: Inspector[] = [];
  #commands = {} as C;
  #commandEmitter = new LiteEmit<MakeEventMap<C>>();
  #usedNames: string[] = [];

  private constructor() {}

  #hasSingleCommand = false;

  get _name() { return this.#name; }
  get _description() { return this.#description; }
  get _version() { return this.#version; }
  get _inspectors() { return this.#inspectors; }
  get _commands() { return this.#commands; }

  /**
   * Create a new cli
   * @returns
   * @example
   * ```ts
   * const cli = Clerc.create()
   * ```
   */
  static create() {
    return new Clerc();
  }

  /**
   * Set the name of the cli
   * @param name
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .name("test")
   * ```
   */
  name(name: string) {
    this.#name = name;
    return this;
  }

  /**
   * Set the description of the cli
   * @param description
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *  .description("test cli")
   */
  description(description: string) {
    this.#description = description;
    return this;
  }

  /**
   * Set the version of the cli
   * @param version
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *  .version("1.0.0")
   */
  version(version: string) {
    this.#version = version;
    return this;
  }

  /**
   * Register a command
   * @param name
   * @param description
   * @param options
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .command("test", "test command", {
   *     alias: "t",
   *     flags: {
   *       foo: {
   *         alias: "f",
   *         description: "foo flag",
   *       }
   *     }
   *   })
   * ```
   * @example
   * ```ts
   * Clerc.create()
   *   .command("", "single command", {
   *     flags: {
   *       foo: {
   *         alias: "f",
   *         description: "foo flag",
   *       }
   *     }
   *   })
   * ```
   */
  command<N extends string | SingleCommandType, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string | SingleCommandType> = MaybeArray<string | SingleCommandType>, F extends Dict<FlagOptions> = Dict<FlagOptions>>(c: CommandWithHandler<N, O & CommandOptions<[...P], A, F>>): this & Clerc<C & Record<N, Command<N, O>>>;
  command<N extends string | SingleCommandType, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string | SingleCommandType> = MaybeArray<string | SingleCommandType>, F extends Dict<FlagOptions> = Dict<FlagOptions>>(name: N, description: string, options?: O & CommandOptions<[...P], A, F>): this & Clerc<C & Record<N, Command<N, O>>>;
  command(nameOrCommand: any, description?: any, options: any = {}) {
    const checkIsCommandObject = (nameOrCommand: any): nameOrCommand is CommandWithHandler => !(typeof nameOrCommand === "string" || nameOrCommand === SingleCommand);

    const isCommandObject = checkIsCommandObject(nameOrCommand);
    const name: CommandType = !isCommandObject ? nameOrCommand : nameOrCommand.name;
    if (this.#commands[name]) {
      throw new CommandExistsError(typeof name === "symbol" ? "" : name);
    }
    if (isInvalidName(name)) {
      throw new InvalidCommandNameError(name as string);
    }
    // if (this.#isSingleCommand) {
    //   throw new SingleCommandError();
    // }
    // if (name === SingleCommand && this.#hasCommands) {
    //   throw new CommonCommandExistsError();
    // }
    // if (name === SingleCommand && (isCommandObject ? nameOrCommand : options).alias) {
    //   throw new SingleCommandAliasError();
    // }
    const { handler = undefined, ...commandToSave } = isCommandObject ? nameOrCommand : { name, description, ...options };

    // Check if alias or name conflicts
    const nameList = [commandToSave.name];
    commandToSave.alias && nameList.push(...toArray(commandToSave.alias));
    for (const name of nameList) {
      if (this.#usedNames.includes(name)) {
        throw new CommandExistsError(name);
      }
    }
    if (nameList.includes(SingleCommand)) {
      this.#hasSingleCommand = true;
    }
    this.#commands[name as keyof C] = commandToSave;
    this.#usedNames.push(commandToSave.name, ...(toArray(commandToSave.alias) || []));

    // Register handler
    isCommandObject && handler && this.on(nameOrCommand.name, handler as any);

    return this as any;
  }

  /**
   * Register a handler
   * @param name
   * @param handler
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .command("test", "test command")
   *   .on("test", (ctx) => {
   *     console.log(ctx);
   *   })
   * ```
   */
  on<K extends LiteralUnion<keyof CM, string>, CM extends this["_commands"] = this["_commands"]>(name: K, handler: Handler<CM, K>) {
    this.#commandEmitter.on(name as any, handler as any);
    return this;
  }

  /**
   * Use a plugin
   * @param plugin
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .use(plugin)
   * ```
   */
  use<T extends Clerc, U extends Clerc>(plugin: Plugin<T, U>): this & Clerc<C & U["_commands"]> & U {
    return plugin.setup(this as any) as any;
  }

  /**
   * Register a inspector
   * @param inspector
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .inspector((ctx, next) => {
   *     console.log(ctx);
   *     next();
   *   })
   * ```
   */
  inspector(inspector: Inspector) {
    this.#inspectors.push(inspector);
    return this;
  }

  /**
   * Parse the command line arguments
   * @param args
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .parse(process.argv.slice(2)) // Optional
   * ```
   */
  parse(argv = resolveArgv()) {
    if (!this.#name) {
      throw new NameNotSetError();
    }
    if (!this.#description) {
      throw new DescriptionNotSetError();
    }
    if (!this.#version) {
      throw new VersionNotSetError();
    }
    const name = resolveParametersBeforeFlag(argv);
    const stringName = name.join(" ");
    const getCommand = () => resolveCommand(this.#commands, name);
    const mapErrors = [] as (Error | undefined)[];
    const getContext = () => {
      mapErrors.length = 0;
      const command = getCommand();
      const isCommandResolved = !!command;
      // [...argv] is a workaround since TypeFlag modifies argv
      const parsed = typeFlag(command?.flags || {}, [...argv]);
      const { _: args, flags, unknownFlags } = parsed;
      let parameters = !isCommandResolved || command.name === SingleCommand ? args : args.slice(command.name.split(" ").length);
      let commandParameters = command?.parameters || [];
      // eof handle
      const hasEof = commandParameters.indexOf("--");
      const eofParameters = commandParameters.slice(hasEof + 1) || [];
      const mapping: Record<string, string | string[]> = Object.create(null);
      // Support `--` eof parameters
      if (hasEof > -1 && eofParameters.length > 0) {
        commandParameters = commandParameters.slice(0, hasEof);
        const eofArguments = args["--"];
        parameters = parameters.slice(0, -eofArguments.length || undefined);

        mapErrors.push(mapParametersToArguments(
          mapping,
          parseParameters(commandParameters),
          parameters,
        ));
        mapErrors.push(mapParametersToArguments(
          mapping,
          parseParameters(eofParameters),
          eofArguments,
        ));
      } else {
        mapErrors.push(mapParametersToArguments(
          mapping,
          parseParameters(commandParameters),
          parameters,
        ));
      }
      const mergedFlags = { ...flags, ...unknownFlags };
      const context: InspectorContext | HandlerContext = {
        name: command?.name as any,
        resolved: isCommandResolved as any,
        hasSingleCommand: this.#hasSingleCommand,
        raw: { ...parsed, parameters, mergedFlags },
        parameters: mapping,
        flags,
        unknownFlags,
        cli: this as any,
      };
      return context;
    };
    const emitHandler: Inspector = {
      enforce: "post",
      fn: () => {
        const command = getCommand();
        const handlerContext = getContext();
        const errors = mapErrors.filter(Boolean) as Error[];
        if (errors.length > 0) {
          throw errors[0];
        }
        if (!command) {
          if (stringName) {
            throw new NoSuchCommandError(stringName);
          } else {
            throw new NoCommandGivenError();
          }
        }
        this.#commandEmitter.emit(command.name, handlerContext);
      },
    };
    const inspectors = [...this.#inspectors, emitHandler];
    const callInspector = compose(inspectors);
    callInspector(getContext);
    return this;
  }
}
