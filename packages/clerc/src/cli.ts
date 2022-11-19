import { LiteEmit } from "lite-emit";
import mri from "mri";
import { typeFlag } from "type-flag";
import type { LiteralUnion } from "@clerc/utils";

import { CommandExistsError, CommonCommandExistsError, NoSuchCommandError, SingleCommandError } from "./errors";
import type { Command, CommandOptions, CommandRecord, Handler, HandlerContext, Inspector, InspectorContext, MakeEventMap, Plugin } from "./types";
import { compose, resolveArgv, resolveCommand } from "./utils";

export const SingleCommand = Symbol("SingleCommand");
export type SingleCommandType = typeof SingleCommand;

export class Clerc<C extends CommandRecord = {}> {
  _name = "";
  _description = "";
  _version = "";
  _inspectors: Inspector[] = [];
  _commands = {} as C;

  // TODO: Shall we use ES private fields?
  private __commandEmitter = new LiteEmit<MakeEventMap<C>>();

  private constructor () {}

  private get __isSingleCommand () { return this._commands[SingleCommand] !== undefined; }
  private get __hasCommands () { return Object.keys(this._commands).length > 0; }

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
    this._name = name;
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
    this._description = description;
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
    this._version = version;
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
    if (this._commands[name]) {
      if (name === SingleCommand) {
        throw new CommandExistsError("Single command already exists");
      }
      throw new CommandExistsError(`Command "${name === SingleCommand ? "[SingleCommand]" : name as string}" already exists`);
    }
    if (this.__isSingleCommand) {
      throw new SingleCommandError("Single command mode enabled");
    }
    if (name === SingleCommand && this.__hasCommands) {
      throw new CommonCommandExistsError("Common command exists");
    }
    const { alias, flags } = options;
    this._commands[name] = { name, description, alias, flags } as any;
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
    this.__commandEmitter.on(name as any, handler as any);
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
    this._inspectors.push(inspector);
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
    const parsed = mri(argv);
    const name = String(parsed._[0]);
    const command = this.__isSingleCommand ? this._commands[SingleCommand] : resolveCommand(this._commands, name);
    const isCommandResolved = !!command;
    const parsedWithType = typeFlag(command?.flags || {}, argv);
    // const parsedWithType = typeFlag();
    const { _: args, flags } = parsedWithType;
    // e.g cli a-command-does-not-exist -h
    const parameters = this.__isSingleCommand || !isCommandResolved ? args : args.slice(1);
    const inspectorContext: InspectorContext = {
      name: command?.name,
      resolved: isCommandResolved,
      isSingleCommand: this.__isSingleCommand,
      raw: parsedWithType,
      parameters,
      flags,
      cli: this as any,
    };
    const handlerContext = inspectorContext as HandlerContext;
    const emitHandler = () => {
      if (!command) {
        throw new NoSuchCommandError(`No such command: ${name}`);
      }
      this.__commandEmitter.emit(command.name, handlerContext);
    };
    const inspectors = [...this._inspectors, emitHandler];
    const inspector = compose(inspectors);
    inspector(inspectorContext);
  }
}
