import { parse } from "@clerc/parser";
import type { LiteralUnion } from "@clerc/utils";
import { toArray } from "@clerc/utils";
import { LiteEmit } from "lite-emit";

import { resolveCommand } from "./commands";
import { getParametersToResolve } from "./parameters";
import { platformArgv } from "./platform";
import type {
	ClercFlagsDefinition,
	Command,
	CommandOptions,
	CommandsMap,
	CommandsRecord,
	Context,
	MakeEmitterEvents,
} from "./types";

interface CreateOptions {
	name?: string;
	scriptName?: string;
	description?: string;
	version?: string;
}

export class Clerc<Commands extends CommandsRecord = {}> {
	#commands: CommandsMap = new Map();
	#emitter = new LiteEmit<MakeEmitterEvents<Commands>>();
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

	#validateCommandNameAndAlias(name: string, aliases: string[]) {
		if (this.#commands.has(name)) {
			throw new Error(`Command with name "${name}" already exists.`);
		}
		for (const alias of aliases) {
			if (this.#commands.has(alias)) {
				throw new Error(`Command with name "${alias}" already exists.`);
			}
		}
	}

	public command<
		Name extends string,
		Parameters extends string[] = [],
		Flags extends ClercFlagsDefinition = {},
	>(
		name: Name extends keyof Commands ? never : Name,
		description: string,
		options?: CommandOptions<[...Parameters], Flags>,
	): Clerc<Commands & Record<Name, Command<Name, Parameters, Flags>>> {
		const aliases = toArray(options?.alias ?? []);

		this.#validateCommandNameAndAlias(name, aliases);

		const command = {
			name,
			description,
			...options,
		};

		this.#commands.set(name, command);
		for (const alias of aliases) {
			this.#commands.set(alias, command);
		}

		return this as any;
	}

	public on<Name extends LiteralUnion<keyof Commands, string>>(
		name: Name,
		handler: (context: Context<Commands[Name]>) => void,
	): this {
		this.#emitter.on(name, handler);

		return this;
	}

	#validate() {
		if (!this.#name) {
			throw new Error("CLI name is required.");
		}
		if (!this.#scriptName) {
			throw new Error("CLI script name is required.");
		}
		if (!this.#version) {
			throw new Error("CLI version is required.");
		}
	}

	public parse(argv: string[] = platformArgv): void {
		this.#validate();

		const [command, calledAs] = resolveCommand(
			this.#commands,
			getParametersToResolve(argv),
		);

		if (!command) {
			throw new Error("No matching command found.");
		}

		const parsed = parse(argv, {
			flags: command?.flags,
		});

		const context: Context<Command> = {
			command,
			calledAs,
			...parsed,
		};

		this.#emitter.emit(command.name, context as any);
	}
}
