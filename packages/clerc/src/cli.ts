import { LiteEmit } from "lite-emit";
import minimist from "minimist";
import type { Command, CommandOptions, CommandRecord, Handler, Invoker, InvokerContext, MakeEventMap, Plugin } from "./types";
import { compose, resolveArgv, resolveCommand, resolveFlagAlias } from "./utils";

export class Clerc<C extends CommandRecord = {}> {
  _name = "";
  _description = "";
  _invokers: Invoker[] = [];
  _commands = {} as C;

  /**
   * Can't use private fields because of plugin
   * @private
   * @internal
   *
   */
  __command_emitter = new LiteEmit<MakeEventMap<C>>();

  private constructor () {}

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
   *   .command("_", "wildcard command", {
   *     flags: {
   *       foo: {
   *         alias: "f",
   *         description: "foo flag",
   *       }
   *     }
   *   })
   * ```
   */
  command<N extends string, D extends string>(name: N, description: D, options: CommandOptions = {}): this & Clerc<C & Record<N, Command<N, D>>> {
    if (this._commands[name]) {
      throw new Error(`Command "${name}" already exists`);
    }
    if (this._commands._) {
      throw new Error("Already has a wildcard command");
    }
    if (name === "_" && Object.keys(this._commands).length > 0) {
      throw new Error("Already has commands");
    }
    const { alias = [], flags = {} } = options;
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
  on<K extends keyof C>(name: K, handler: Handler) {
    this.__command_emitter.on(name, handler);
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
  use<T extends Clerc, U>(plugin: Plugin<U, T>): U {
    return plugin.setup(this as any);
  }

  /**
   * Register a invoker
   * @param invoker
   * @returns
   * @example
   * ```ts
   * Clerc.create()
   *   .registerInvoker((ctx, next) => {
   *     console.log(ctx);
   *     next();
   *   })
   * ```
   */
  registerInvoker (invoker: Invoker) {
    this._invokers.push(invoker);
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
    let parsed = minimist(argv);
    const name = parsed._[0];
    const command = resolveCommand(this._commands, name || "_");
    if (!command) {
      throw new Error(`No such command: ${name}`);
    }
    const commandName = command.name;
    parsed = minimist(argv, {
      alias: resolveFlagAlias(command),
    });
    const { _: args, ...flags } = parsed;
    const [_, ...parameters] = args;
    if (!command) {
      throw new Error(`Command "${name}" not found`);
    }
    const invokerContext: InvokerContext<C> = {
      name,
      parameters,
      flags,
      cli: this,
    };
    const handlerContext = invokerContext;
    const emitHandler = () => {
      this.__command_emitter.emit(commandName, handlerContext as any);
    };
    const invokers = [...this._invokers, emitHandler];
    const invoker = compose(invokers);
    invoker(invokerContext as any);
  }
}
