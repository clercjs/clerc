import { LiteEmit } from "lite-emit";
import minimist from "minimist";
import type { Command, CommandOptions, CommandRecord, Handler, Invoker, InvokerContext, MakeEventMap, Plugin } from "./types";
import { compose, resolveCommand, resolveFlagAlias } from "./utils";

export class Clerc<C extends CommandRecord = {}> {
  _name = "";
  _description = "";
  _version = "";
  _invokers: Invoker[] = [];
  _commands = {} as C;

  // Can't use private fields because of plugin
  __command_emitter = new LiteEmit<MakeEventMap<C>>();

  private constructor () {}

  static create () {
    return new Clerc();
  }

  name (name: string) {
    this._name = name;
    return this;
  }

  description (description: string) {
    this._description = description;
    return this;
  }

  version (version: string) {
    this._version = version;
    return this;
  }

  command<N extends string, D extends string>(name: N, description: D, options: CommandOptions = {}): this & Clerc<C & Record<N, Command<N, D>>> {
    const { alias = [], flags = {} } = options;
    this._commands[name] = { name, description, alias, flags } as any;
    return this as any;
  }

  on<K extends keyof C>(name: K, cb: Handler) {
    this.__command_emitter.on(name, cb);
    return this;
  }

  use<T extends Clerc, U>(plugin: Plugin<U, T>): U {
    return plugin.setup(this as any);
  }

  registerInvoker (invoker: Invoker) {
    this._invokers.push(invoker);
    return this;
  }

  parse () {
    const argv = process.argv.slice(2);
    let parsed = minimist(argv);
    const name = parsed._[0];
    const command = resolveCommand(this._commands, name || "_");
    if (!command) {
      throw new Error(`No such command: ${name}`);
    }
    const commandName = command.name;
    parsed = minimist(argv, {
      alias: resolveFlagAlias(this._commands[commandName]),
    });
    if (!command) {
      throw new Error(`Command "${name}" not found`);
    }
    const invokerContext: InvokerContext<C> = {
      name,
      flags: parsed,
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
