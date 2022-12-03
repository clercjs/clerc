import { LiteEmit } from "lite-emit";
import { typeFlag } from "type-flag";
import type { Dict, LiteralUnion, MaybeArray } from "@clerc/utils";
import { arrayStartsWith } from "@clerc/utils";

import { CommandExistsError, CommonCommandExistsError, NoSuchCommandError, ParentCommandExistsError, SingleCommandAliasError, SingleCommandError, SubcommandExistsError } from "./errors";
import type { Command, CommandOptions, CommandRecord, CommandWithHandler, FlagOptions, Handler, HandlerContext, Inspector, InspectorContext, MakeEventMap, Plugin } from "./types";
import { compose, resolveArgv, resolveCommand, resolveParametersBeforeFlag } from "./utils";
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

  private constructor () {}

  get #isSingleCommand () { return this.#commands[SingleCommand] !== undefined; }
  get #hasCommands () { return Object.keys(this.#commands).length > 0; }

  get _name () { return this.#name; }
  get _description () { return this.#description; }
  get _version () { return this.#version; }
  get _inspectors () { return this.#inspectors; }
  get _commands () { return this.#commands; }

  /**
   * Create a new cli
   * @returns
   * @example
   * ```ts
   * const cli = Clerc.create()
   * ```
   */
  static create () {
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
  name (name: string) {
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
  description (description: string) {
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
  version (version: string) {
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
  command<N extends string | SingleCommandType, D extends string, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string> = MaybeArray<string>, F extends Dict<FlagOptions> = Dict<FlagOptions>>(c: CommandWithHandler<N, D, O & CommandOptions<[...P], A, F>>): this & Clerc<C & Record<N, Command<N, D, O>>>;
  command<N extends string | SingleCommandType, D extends string, P extends string[], O extends CommandOptions<[...P]>>(name: N, description: D, options?: O & CommandOptions<[...P]>): this & Clerc<C & Record<N, Command<N, D, O>>>;
  command (nameOrCommand: any, description?: any, options?: any) {
    const checkIsCommandObject = (nameOrCommand: any): nameOrCommand is CommandWithHandler => !(typeof nameOrCommand === "string" || nameOrCommand === SingleCommand);
    const isCommandObject = checkIsCommandObject(nameOrCommand);
    const name: string | SingleCommandType = !isCommandObject ? nameOrCommand : nameOrCommand.name;
    if (this.#commands[name]) {
      if (name === SingleCommand) {
        throw new CommandExistsError("SingleCommand");
      }
    }
    if (this.#isSingleCommand) {
      throw new SingleCommandError();
    }
    if (name === SingleCommand && this.#hasCommands) {
      throw new CommonCommandExistsError();
    }
    if (name === SingleCommand && (isCommandObject ? nameOrCommand : options).alias) {
      throw new SingleCommandAliasError();
    }
    // Check if this is a subcommand, or a parent command
    // Cannot exist with its parent or children
    // e.g `foo` and `foo bar`
    if (name !== SingleCommand) {
      const splitedName = name.split(" ");
      const existedCommandNames = Object.keys(this.#commands)
        .filter(name => typeof name === "string")
        .map(name => name.split(" "));
      if (existedCommandNames.some(name => arrayStartsWith(splitedName, name))) {
        throw new ParentCommandExistsError(splitedName.join(" "));
      }
      if (existedCommandNames.some(name => arrayStartsWith(name, splitedName))) {
        throw new SubcommandExistsError(splitedName.join(" "));
      }
    }

    this.#commands[name as keyof C] = !isCommandObject ? { name, description, ...options } : nameOrCommand;
    if (isCommandObject && nameOrCommand.handler) {
      this.on(nameOrCommand.name, nameOrCommand.handler as any);
    }
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
  on<K extends keyof CM, CM extends this["_commands"] = this["_commands"]>(name: LiteralUnion<K, string>, handler: Handler<CM, K>) {
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
  use<T extends Clerc, U extends Clerc>(plugin: Plugin<T, U>): U {
    return plugin.setup(this as any);
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
  inspector (inspector: Inspector) {
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
  parse (argv = resolveArgv()) {
    const name = resolveParametersBeforeFlag(argv, this.#isSingleCommand);
    const stringName = name.join(" ");
    const getCommand = () => this.#isSingleCommand ? this.#commands[SingleCommand] : resolveCommand(this.#commands, name);
    const getContext = () => {
      const command = getCommand();
      const isCommandResolved = !!command;
      // [...argv] is a workaround
      // WTF... typeFlag modifies argv????????
      const parsed = typeFlag(command?.flags || {}, [...argv]);
      const { _: args, flags } = parsed;
      let parameters = this.#isSingleCommand || !isCommandResolved ? args : args.slice(command.name.split(" ").length);
      let commandParameters = command?.parameters || [];
      // eof handle
      const hasEof = commandParameters.indexOf("--");
      const eofParameters = commandParameters.slice(hasEof + 1) || [];
      const mapping: Record<string, string | string[]> = Object.create(null);
      // Support `--` eof parameters
      if (hasEof > -1 && eofParameters.length > 0) {
        commandParameters = commandParameters.slice(0, hasEof);
        const eofArguments = parsed._["--"];
        parameters = parameters.slice(0, -eofArguments.length || undefined);

        mapParametersToArguments(
          mapping,
          parseParameters(commandParameters),
          parameters,
        );
        mapParametersToArguments(
          mapping,
          parseParameters(eofParameters),
          eofArguments,
        );
      } else {
        mapParametersToArguments(
          mapping,
          parseParameters(commandParameters),
          parameters,
        );
      }
      const context: InspectorContext | HandlerContext = {
        name: command?.name,
        resolved: isCommandResolved,
        isSingleCommand: this.#isSingleCommand,
        raw: parsed,
        parameters: mapping,
        flags,
        unknownFlags: parsed.unknownFlags,
        cli: this as any,
      };
      return context;
    };
    const emitHandler = () => {
      const command = getCommand();
      const handlerContext = getContext();
      if (!command) {
        throw new NoSuchCommandError(stringName);
      }
      this.#commandEmitter.emit(command.name, handlerContext);
    };
    const inspectors = [...this.#inspectors, emitHandler];
    const callInspector = compose(inspectors);
    callInspector(getContext);
    return this;
  }
}
