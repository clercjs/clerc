import { LiteEmit } from "lite-emit";
import { typeFlag } from "type-flag";
import type { LiteralUnion } from "@clerc/utils";
import { arrayStartsWith } from "@clerc/utils";

import { CommandExistsError, CommonCommandExistsError, NoSuchCommandError, ParentCommandExistsError, SingleCommandError, SubcommandExistsError } from "./errors";
import type { Command, CommandOptions, CommandRecord, Handler, HandlerContext, Inspector, InspectorContext, MakeEventMap, Plugin } from "./types";
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
  command<N extends string | SingleCommandType, D extends string, O extends CommandOptions>(name: N, description: D, options: O = {} as any): this & Clerc<C & Record<N, Command<N, D, O>>> {
    if (this.#commands[name]) {
      if (name === SingleCommand) {
        throw new CommandExistsError("Single command already exists");
      }
      throw new CommandExistsError(`Command "${name === SingleCommand ? "[SingleCommand]" : name as string}" already exists`);
    }
    if (this.#isSingleCommand) {
      throw new SingleCommandError();
    }
    if (name === SingleCommand && this.#hasCommands) {
      throw new CommonCommandExistsError();
    }
    // Check if this is a subcommand
    // Cannot exist with its parent
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

    this.#commands[name] = { name, description, ...options } as any;
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
      const parameters = this.#isSingleCommand || !isCommandResolved ? args : args.slice(command.name.split(" ").length);
      const mapping: Record<string, string | string[]> = Object.create(null);
      mapParametersToArguments(
        mapping,
        parseParameters(parameters),
        parameters,
      );
      console.log(args, 1231231312);
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
    const inspector = compose(inspectors);
    inspector(getContext);
    return this;
  }
}
