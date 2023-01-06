import { LiteEmit } from "lite-emit";
import { typeFlag } from "type-flag";
import type { LiteralUnion, MaybeArray } from "@clerc/utils";
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
  Flags,
  Handler,
  HandlerContext,
  Inspector,
  InspectorContext,
  MakeEventMap,
  Plugin,
} from "./types";
import {
  compose,
  formatCommandName,
  isInvalidName,
  resolveArgv,
  resolveCommand,
  resolveParametersBeforeFlag,
} from "./utils";
import { mapParametersToArguments, parseParameters } from "./parameters";

export const Root = Symbol("Root");
export type RootType = typeof Root;

export class Clerc<C extends CommandRecord = {}> {
  #name = "";
  #description = "";
  #version = "";
  #inspectors: Inspector[] = [];
  #commands = {} as C;
  #commandEmitter = new LiteEmit<MakeEventMap<C>>();
  #usedNames = new Set<string | RootType>();

  private constructor(name?: string, description?: string, version?: string) {
    this.#name = name || this.#name;
    this.#description = description || this.#description;
    this.#version = version || this.#version;
  }

  get #hasRootOrAlias() {
    return this.#usedNames.has(Root);
  }

  get #hasRoot() {
    return Object.prototype.hasOwnProperty.call(this._commands, Root);
  }

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
  static create(name?: string, description?: string, version?: string) {
    return new Clerc(name, description, version);
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
   *   .command("", "root", {
   *     flags: {
   *       foo: {
   *         alias: "f",
   *         description: "foo flag",
   *       }
   *     }
   *   })
   * ```
   */
  command<N extends string | RootType, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string | RootType> = MaybeArray<string | RootType>, F extends Flags = Flags>(c: CommandWithHandler<N, O & CommandOptions<[...P], A, F>>): this & Clerc<C & Record<N, Command<N, O>>>;
  command<N extends string | RootType, O extends CommandOptions<[...P], A, F>, P extends string[] = string[], A extends MaybeArray<string | RootType> = MaybeArray<string | RootType>, F extends Flags = Flags>(name: N, description: string, options?: O & CommandOptions<[...P], A, F>): this & Clerc<C & Record<N, Command<N, O>>>;
  command(nameOrCommand: any, description?: any, options: any = {}) {
    const checkIsCommandObject = (nameOrCommand: any): nameOrCommand is CommandWithHandler => !(typeof nameOrCommand === "string" || nameOrCommand === Root);

    const isCommandObject = checkIsCommandObject(nameOrCommand);
    const name: CommandType = !isCommandObject ? nameOrCommand : nameOrCommand.name;
    if (isInvalidName(name)) {
      throw new InvalidCommandNameError(name as string);
    }
    const { handler = undefined, ...commandToSave } = isCommandObject ? nameOrCommand : { name, description, ...options };

    // Check if alias or name conflicts
    const nameList = [commandToSave.name];
    commandToSave.alias && nameList.push(...toArray(commandToSave.alias));
    for (const name of nameList) {
      if (this.#usedNames.has(name)) {
        throw new CommandExistsError(formatCommandName(name));
      }
    }
    this.#commands[name as keyof C] = commandToSave;
    this.#usedNames.add(commandToSave.name);
    (toArray(commandToSave.alias) || []).forEach(a => this.#usedNames.add(a));

    // Register handler
    isCommandObject && handler && this.on(nameOrCommand.name, handler);

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
      let parameters = !isCommandResolved || command.name === Root ? args : args.slice(command.name.split(" ").length);
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
        called: name.length === 0 && command?.name ? Root : stringName,
        resolved: isCommandResolved as any,
        hasRootOrAlias: this.#hasRootOrAlias,
        hasRoot: this.#hasRoot,
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
