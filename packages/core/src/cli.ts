import { LiteEmit } from "lite-emit";
import type { LiteralUnion } from "type-fest";

import { platformArgv } from "./platform";
import type { Command, CommandOptions } from "./types";

export class Clerc<Commands extends Record<string, Command> = {}> {
	#commands = new Map<string, Command>();
	#emitter = new LiteEmit();

	private constructor() {}

	public static create() {
		return new Clerc();
	}

	public command<Name extends string, Parameters extends string[]>(
		name: Name,
		description: string,
		options?: CommandOptions<[...Parameters]>,
	): Clerc<Commands & Record<Name, Command<Parameters>>> {
		this.#commands.set(name, {
			name,
			description,
			...options,
		});

		return this as any;
	}

	public on<Name extends LiteralUnion<keyof Commands, string>>(
		name: Name,
		handler: (
			// WIP: CTX
			ctx: any,
		) => void,
	): this {
		const ctx = {};
		this.#emitter.on(name as PropertyKey, () => {
			handler(ctx);
		});

		return this;
	}

	public parse(argv: string[] = platformArgv): void {}
}

const cli = Clerc.create()
	.command("serve", "Start the server", {
		parameters: ["port", "host"],
	})
	.on("s");
