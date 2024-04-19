import { format } from "node:util";

import type { MaybeArray } from "@clerc/utils";
import { toArray } from "@clerc/utils";
import { defu } from "defu";
import { LiteEmit } from "lite-emit";
import type { LiteralUnion } from "type-fest";
import { typeFlag } from "type-flag";

import {
	CommandExistsError,
	DescriptionNotSetError,
	InvalidCommandNameError,
	LocaleNotCalledFirstError,
	NoCommandGivenError,
	NoSuchCommandError,
	ScriptNameNotSetError,
	VersionNotSetError,
} from "./errors";
import { locales } from "./locales";
import { mapParametersToArguments, parseParameters } from "./parameters";
import type {
	Command,
	CommandOptions,
	CommandType,
	CommandWithHandler,
	Commands,
	Flags,
	GlobalFlagOption,
	GlobalFlagOptions,
	Handler,
	HandlerContext,
	I18N,
	Interceptor,
	InterceptorContext,
	Locales,
	MakeEventMap,
	ParseOptions,
	Plugin,
} from "./types";
import {
	compose,
	detectLocale,
	formatCommandName,
	isValidName,
	resolveArgv,
	resolveCommand,
	stripFlags,
} from "./utils";

export const Root = Symbol.for("Clerc.Root");
export type RootType = typeof Root;

export class Clerc<C extends Commands = {}, GF extends GlobalFlagOptions = {}> {
	#name = "";
	#scriptName = "";
	#description = "";
	#version = "";
	#interceptors: Interceptor[] = [];
	#commands = Object.create(null) as C;
	#commandEmitter = new LiteEmit<MakeEventMap<C>>({
		errorHandler: (msg) => {
			this.#handleError(new Error(msg));
		},
	});

	#flags = Object.create(null) as GF;
	#usedNames = new Set<string | RootType>();
	#argv: string[] | undefined;
	#errorHandlers = [] as ((err: any) => void)[];
	#isOtherMethodCalled = false;
	#defaultLocale = "en";
	#locale = "en";
	#locales: Locales = Object.create(null);
	public get i18n(): I18N {
		return {
			add: (locales) => {
				this.#locales = defu(this.#locales, locales);
			},
			t: (name, ...args) => {
				const localeObject =
					this.#locales[this.#locale] || this.#locales[this.#defaultLocale];
				const defaultLocaleObject = this.#locales[this.#defaultLocale];

				return localeObject[name]
					? format(localeObject[name], ...args)
					: defaultLocaleObject[name]
						? format(defaultLocaleObject[name], ...args)
						: undefined;
			},
		};
	}

	private constructor(
		scriptName?: string,
		description?: string,
		version?: string,
	) {
		this.#scriptName = scriptName ?? this.#scriptName;
		this.#description = description ?? this.#description;
		this.#version = version ?? this.#version;
		this.#locale = detectLocale();
		this.#addCoreLocales();
	}

	get #hasRootOrAlias() {
		return this.#usedNames.has(Root);
	}

	get #hasRoot() {
		return Object.prototype.hasOwnProperty.call(this._commands, Root);
	}

	public get _name() {
		return this.#name || this.#scriptName;
	}

	public get _scriptName() {
		return this.#scriptName;
	}

	public get _description() {
		return this.#description;
	}

	public get _version() {
		return this.#version;
	}

	/**
	 * @deprecated This is a typo. Use `_interceptor` instead.
	 */
	public get _inspectors() {
		return this.#interceptors;
	}

	public get _interceptors() {
		return this.#interceptors;
	}

	public get _commands() {
		return this.#commands;
	}

	public get _flags() {
		return this.#flags;
	}

	#addCoreLocales() {
		this.i18n.add(locales);
	}

	#otherMethodCalled() {
		this.#isOtherMethodCalled = true;
	}

	/**
	 * Create a new cli
	 *
	 * @example
	 *
	 * ```ts
	 * const cli = Clerc.create();
	 * ```
	 *
	 * @param name
	 * @param description
	 * @param version
	 * @returns
	 */
	public static create(name?: string, description?: string, version?: string) {
		return new Clerc(name, description, version);
	}

	/**
	 * Set the name of the cli
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().name("test");
	 * ```
	 *
	 * @param name
	 * @returns
	 */
	public name(name: string) {
		this.#otherMethodCalled();
		this.#name = name;

		return this;
	}

	/**
	 * Set the script name of the cli
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().scriptName("test");
	 * ```
	 *
	 * @param scriptName
	 * @returns
	 */
	public scriptName(scriptName: string) {
		this.#otherMethodCalled();
		this.#scriptName = scriptName;

		return this;
	}

	/**
	 * Set the description of the cli
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().description("test cli");
	 * ```
	 *
	 * @param description
	 * @returns
	 */
	public description(description: string) {
		this.#otherMethodCalled();
		this.#description = description;

		return this;
	}

	/**
	 * Set the version of the cli
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().version("1.0.0");
	 * ```
	 *
	 * @param version
	 * @returns
	 */
	public version(version: string) {
		this.#otherMethodCalled();
		this.#version = version;

		return this;
	}

	/**
	 * Set the Locale You must call this method once after you created the Clerc
	 * instance.
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create()
	 *   .locale("en")
	 *   .command(...)
	 * ```
	 *
	 * @param locale
	 * @returns
	 */
	public locale(locale: string) {
		if (this.#isOtherMethodCalled) {
			throw new LocaleNotCalledFirstError(this.i18n.t);
		}
		this.#locale = locale;

		return this;
	}

	/**
	 * Set the fallback Locale You must call this method once after you created
	 * the Clerc instance.
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create()
	 *   .fallbackLocale("en")
	 *   .command(...)
	 * ```
	 *
	 * @param fallbackLocale
	 * @returns
	 */
	public fallbackLocale(fallbackLocale: string) {
		if (this.#isOtherMethodCalled) {
			throw new LocaleNotCalledFirstError(this.i18n.t);
		}
		this.#defaultLocale = fallbackLocale;

		return this;
	}

	/**
	 * Register a error handler
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().errorHandler((err) => {
	 * 	console.log(err);
	 * });
	 * ```
	 *
	 * @param handler
	 * @returns
	 */
	public errorHandler(handler: (err: any) => void) {
		this.#errorHandlers.push(handler);

		return this;
	}

	/**
	 * Register a command
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().command("test", "test command", {
	 * 	alias: "t",
	 * 	flags: {
	 * 		foo: {
	 * 			alias: "f",
	 * 			description: "foo flag",
	 * 		},
	 * 	},
	 * });
	 * ```
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().command("", "root", {
	 * 	flags: {
	 * 		foo: {
	 * 			alias: "f",
	 * 			description: "foo flag",
	 * 		},
	 * 	},
	 * });
	 * ```
	 *
	 * @param name
	 * @param description
	 * @param options
	 * @returns
	 */
	public command<C extends CommandWithHandler<any, any>[]>(c: [...C]): this; // TODO: type inference
	public command<
		N extends string | RootType,
		O extends CommandOptions<[...P], A, F>,
		P extends string[] = string[],
		A extends MaybeArray<string | RootType> = MaybeArray<string | RootType>,
		F extends Flags = Flags,
	>(
		c: CommandWithHandler<N, O & CommandOptions<[...P], A, F>>,
	): this & Clerc<C & Record<N, Command<N, O>>, GF>;
	public command<
		N extends string | RootType,
		O extends CommandOptions<[...P], A, F>,
		P extends string[] = string[],
		A extends MaybeArray<string | RootType> = MaybeArray<string | RootType>,
		F extends Flags = Flags,
	>(
		name: N,
		description: string,
		options?: O & CommandOptions<[...P], A, F>,
	): this & Clerc<C & Record<N, Command<N, O>>, GF>;
	public command(nameOrCommand: any, description?: any, options: any = {}) {
		this.#callWithErrorHandling(() => {
			if (Array.isArray(nameOrCommand)) {
				for (const command of nameOrCommand) {
					this.#command(command);
				}
			} else {
				this.#command(nameOrCommand, description, options);
			}
		});

		return this;
	}

	#command(nameOrCommand: any, description?: any, options: any = {}) {
		this.#otherMethodCalled();
		const { t } = this.i18n;
		const checkIsCommandObject = (
			nameOrCommand: any,
		): nameOrCommand is CommandWithHandler =>
			!(typeof nameOrCommand === "string" || nameOrCommand === Root);

		const isCommandObject = checkIsCommandObject(nameOrCommand);
		const name: CommandType = isCommandObject
			? nameOrCommand.name
			: nameOrCommand;
		if (!isValidName(name)) {
			throw new InvalidCommandNameError(name as string, t);
		}
		const { handler = undefined, ...commandToSave } = isCommandObject
			? nameOrCommand
			: { name, description, ...options };

		// Check if alias or name conflicts
		const nameList = [commandToSave.name];
		const aliasList = commandToSave.alias ? toArray(commandToSave.alias) : [];
		commandToSave.alias && nameList.push(...aliasList);
		for (const name of nameList) {
			if (this.#usedNames.has(name)) {
				throw new CommandExistsError(formatCommandName(name), t);
			}
		}
		this.#commands[name as keyof C] = commandToSave;
		this.#usedNames.add(commandToSave.name);
		for (const a of aliasList) {
			this.#usedNames.add(a);
		}

		// Register handler
		isCommandObject && handler && this.on(nameOrCommand.name, handler);

		return this as any;
	}

	/**
	 * Register a global flag
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().flag("help", "help", {
	 * 	alias: "h",
	 * 	type: Boolean,
	 * });
	 * ```
	 *
	 * @param name
	 * @param description
	 * @param options
	 * @returns
	 */
	public flag<N extends string, O extends GlobalFlagOption>(
		name: N,
		description: string,
		options: O,
	): this & Clerc<C, GF & Record<N, O>> {
		this.#flags[name] = {
			description,
			...options,
		} as any;

		return this as any;
	}

	/**
	 * Register a handler
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create()
	 * 	.command("test", "test command")
	 * 	.on("test", (ctx) => {
	 * 		console.log(ctx);
	 * 	});
	 * ```
	 *
	 * @param name
	 * @param handler
	 * @returns
	 */
	public on<
		K extends LiteralUnion<keyof CM, string | RootType>,
		CM extends this["_commands"] = this["_commands"],
	>(name: K, handler: Handler<CM, K, this["_flags"]>) {
		this.#commandEmitter.on(name as any, handler as any);

		return this;
	}

	/**
	 * Use a plugin
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().use(plugin);
	 * ```
	 *
	 * @param plugin
	 * @returns
	 */
	public use<T extends Clerc, U extends Clerc>(
		plugin: Plugin<T, U>,
	): this & Clerc<C & U["_commands"]> & U {
		this.#otherMethodCalled();

		return plugin.setup(this as any) as any;
	}

	/**
	 * @deprecated This is a typo. Use `intercetor()` instead.
	 */
	public inspector(interceptor: Interceptor) {
		return this.interceptor(interceptor);
	}

	/**
	 * Register a interceptor
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().interceptor((ctx, next) => {
	 * 	console.log(ctx);
	 * 	next();
	 * });
	 * ```
	 *
	 * @param interceptor
	 * @returns
	 */
	public interceptor(interceptor: Interceptor) {
		this.#otherMethodCalled();
		this.#interceptors.push(interceptor);

		return this;
	}

	/**
	 * Parse the command line arguments
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().parse(process.argv.slice(2)); // Optional
	 * ```
	 *
	 * @param args
	 * @param optionsOrArgv
	 * @returns
	 */
	public parse(optionsOrArgv: string[] | ParseOptions = resolveArgv()) {
		this.#otherMethodCalled();
		const { argv, run }: ParseOptions = Array.isArray(optionsOrArgv)
			? {
					argv: optionsOrArgv,
					run: true,
				}
			: {
					argv: resolveArgv(),
					...optionsOrArgv,
				};
		this.#argv = [...argv];
		this.#validateMeta();
		if (run) {
			this.runMatchedCommand();
		}

		return this;
	}

	#validateMeta() {
		const { t } = this.i18n;
		if (!this.#scriptName) {
			throw new ScriptNameNotSetError(t);
		}
		if (!this.#description) {
			throw new DescriptionNotSetError(t);
		}
		if (!this.#version) {
			throw new VersionNotSetError(t);
		}
	}

	#getContext(getCommand: () => ReturnType<typeof resolveCommand>) {
		const argv = this.#argv!;
		const { t } = this.i18n;
		const [command, called] = getCommand();
		const isCommandResolved = !!command;
		const flagsMerged = {
			...this.#flags,
			...command?.flags,
		};
		// [...argv] is a workaround since TypeFlag modifies argv
		const parsed = typeFlag(flagsMerged, [...argv]);
		const parametersOffset =
			command?.name === Root || called === Root
				? 0
				: called?.length
					? called.length
					: command?.name.split(" ").length;
		const { _: args, flags, unknownFlags } = parsed;
		let parameters =
			!isCommandResolved || command.name === Root
				? args
				: args.slice(parametersOffset);
		let commandParameters = command?.parameters ?? [];
		// eof handle
		const hasEof = commandParameters.indexOf("--");
		const eofParameters = commandParameters.slice(hasEof + 1) || [];
		const mapping: Record<string, string | string[]> = Object.create(null);
		// Support `--` eof parameters
		if (hasEof > -1 && eofParameters.length > 0) {
			commandParameters = commandParameters.slice(0, hasEof);
			const eofArguments = args["--"];
			parameters = parameters.slice(0, -eofArguments.length || undefined);

			mapParametersToArguments(
				mapping,
				parseParameters(commandParameters, t),
				parameters,
				t,
			);
			mapParametersToArguments(
				mapping,
				parseParameters(eofParameters, t),
				eofArguments,
				t,
			);
		} else {
			mapParametersToArguments(
				mapping,
				parseParameters(commandParameters, t),
				parameters,
				t,
			);
		}
		const mergedFlags = { ...flags, ...unknownFlags };
		const context: InterceptorContext | HandlerContext = {
			name: command?.name as any,
			called: Array.isArray(called) ? called.join(" ") : called,
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
	}

	#handleError(e: unknown) {
		if (this.#errorHandlers.length > 0) {
			for (const cb of this.#errorHandlers) {
				cb(e);
			}
		} else {
			throw e;
		}
	}

	#callWithErrorHandling(fn: (...args: any[]) => any) {
		try {
			fn();
		} catch (e) {
			this.#handleError(e);
		}
	}

	#runMatchedCommand() {
		this.#otherMethodCalled();
		const { t } = this.i18n;
		const argv = this.#argv;
		if (!argv) {
			throw new Error(t("core.cliParseMustBeCalled"));
		}
		const getCommand = () => resolveCommand(this.#commands, argv, t);
		const getContext = () => this.#getContext(getCommand);
		const emitHandler: Interceptor = {
			enforce: "post",
			fn: (ctx) => {
				const [command] = getCommand();
				const stringName = stripFlags(argv).join(" ");
				if (!command) {
					const error = stringName
						? new NoSuchCommandError(stringName, t)
						: new NoCommandGivenError(t);
					throw error;
				}
				this.#commandEmitter.emit(command.name, ctx);
			},
		};
		const interceptor = [...this.#interceptors, emitHandler];
		const callInterceptor = compose(interceptor);
		callInterceptor(getContext());
	}

	/**
	 * Run matched command
	 *
	 * @example
	 *
	 * ```ts
	 * Clerc.create().parse({ run: false }).runMatchedCommand();
	 * ```
	 *
	 * @returns
	 */
	public runMatchedCommand() {
		this.#callWithErrorHandling(() => this.#runMatchedCommand());
		process.title = this.#name;

		return this;
	}
}
