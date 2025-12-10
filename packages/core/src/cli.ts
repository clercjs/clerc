import type { FlagDefinitionValue, ParsedResult } from "@clerc/parser";
import { parse } from "@clerc/parser";
import type { LiteralUnion } from "@clerc/utils";
import { toArray } from "@clerc/utils";
import type { ErrorHandler } from "lite-emit";
import { LiteEmit } from "lite-emit";

import { resolveCommand } from "./commands";
import {
	InvalidCommandError,
	MissingRequiredMetadataError,
	NoCommandGivenError,
	NoSuchCommandError,
} from "./errors";
import { compose } from "./interceptor";
import { getParametersToResolve, parseParameters } from "./parameters";
import { platformArgv } from "./platform";
import type {
	BaseContext,
	ClercFlagsDefinition,
	Command,
	CommandHandler,
	CommandOptions,
	CommandWithHandler,
	CommandsMap,
	CommandsRecord,
	Interceptor,
	MakeEmitterEvents,
	Plugin,
} from "./types";

interface CreateOptions {
	name?: string;
	scriptName?: string;
	description?: string;
	version?: string;
}

interface ParseOptions {
	run?: boolean;
}

export class Clerc<
	Commands extends CommandsRecord = {},
	GlobalFlags extends ClercFlagsDefinition = {},
> {
	#argv: string[] = [];
	#commands: CommandsMap = new Map();
	#emitter = new LiteEmit<MakeEmitterEvents<Commands, GlobalFlags>>({
		errorHandler: (error) => this.#handleError(error),
	});

	#globalFlags: GlobalFlags = {} as GlobalFlags;
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
				result.catch((error) => {
					this.#handleError(error);
				});
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

	public command<
		Name extends string,
		Parameters extends string[] = [],
		Flags extends ClercFlagsDefinition = {},
	>(
		command: CommandWithHandler<Name, [...Parameters], Flags>,
	): Clerc<
		Commands & Record<string, CommandWithHandler<Name, Parameters, Flags>>,
		GlobalFlags
	>;
	public command<
		Name extends string,
		Parameters extends string[] = [],
		Flags extends ClercFlagsDefinition = {},
	>(
		name: Name extends keyof Commands
			? // type info
				["COMMAND ALREADY EXISTS"]
			: Name,
		description: string,
		options?: CommandOptions<[...Parameters], Flags>,
	): Clerc<
		Commands & Record<Name, Command<Name, Parameters, Flags>>,
		GlobalFlags
	>;
	public command(
		nameOrCommandObject: any,
		description?: any,
		options?: any,
	): any {
		const command =
			typeof nameOrCommandObject === "string"
				? {
						name: nameOrCommandObject,
						description,
						...options,
					}
				: nameOrCommandObject;

		const aliases = toArray(options?.alias ?? []);

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

	public globalFlag<Name extends string, Flag extends FlagDefinitionValue>(
		name: Name,
		description: string,
		options: Flag,
	): Clerc<Commands, GlobalFlags & Record<Name, Flag>> {
		this.#globalFlags[name] = {
			description,
			...options,
		} as any;

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
		if (!this.#description) {
			throw new MissingRequiredMetadataError("description");
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

	public run(): void {
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
			resolved: !!command,
			command,
			calledAs,
			parameters,
			flags: parsed.flags,
			ignored: parsed.ignored,
			rawParsed: parsed,
			maybeMissingParameters: !!parametersError,
		};

		const emitInterceptor: Interceptor = {
			enforce: "post",
			handler: (ctx) => {
				if (parametersError) {
					throw parametersError;
				}
				if (command) {
					this.#emitter.emit(command.name, ctx as any);
				} else {
					throw parametersToResolve.length > 0
						? new NoSuchCommandError(parametersToResolve.join(" "))
						: new NoCommandGivenError();
				}
			},
		};

		const composedInterceptor = compose([
			...this.#interceptors,
			emitInterceptor,
		]);

		this.#callWithErrorHandler(() => composedInterceptor(context as any));
	}

	public parse(
		argv: string[] = platformArgv,
		{ run = true }: ParseOptions = {},
	): this {
		this.#callWithErrorHandler(() => this.#validate());

		this.#argv = argv;

		if (run) {
			this.run();
		}

		return this;
	}
}
