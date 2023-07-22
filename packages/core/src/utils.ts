import { arrayStartsWith, toArray } from "@clerc/utils";
import { IS_DENO, IS_ELECTRON, IS_NODE } from "is-platform";
import { typeFlag } from "type-flag";

import type { RootType } from "./cli";
import { Root } from "./cli";
import { CommandNameConflictError } from "./errors";
import type {
	Command,
	CommandAlias,
	CommandType,
	Commands,
	Inspector,
	InspectorContext,
	InspectorFn,
	InspectorObject,
	TranslateFn,
} from "./types";

function setCommand(
	commandsMap: Map<string[] | RootType, CommandAlias>,
	commands: Commands,
	command: Command,
	t: TranslateFn,
) {
	if (command.alias) {
		const aliases = toArray(command.alias);
		for (const alias of aliases) {
			if (alias in commands) {
				throw new CommandNameConflictError(
					commands[alias]!.name,
					command.name,
					t,
				);
			}
			commandsMap.set(typeof alias === "symbol" ? alias : alias.split(" "), {
				...command,
				__isAlias: true,
			});
		}
	}
}

export function resolveFlattenCommands(commands: Commands, t: TranslateFn) {
	const commandsMap = new Map<string[] | RootType, CommandAlias>();
	if (commands[Root]) {
		commandsMap.set(Root, commands[Root]);
		setCommand(commandsMap, commands, commands[Root], t);
	}
	for (const command of Object.values(commands)) {
		setCommand(commandsMap, commands, command, t);
		commandsMap.set(command.name.split(" "), command);
	}

	return commandsMap;
}

export function resolveCommand(
	commands: Commands,
	argv: string[],
	t: TranslateFn,
): [Command<string | RootType> | undefined, string[] | RootType | undefined] {
	const commandsMap = resolveFlattenCommands(commands, t);
	for (const [name, command] of commandsMap.entries()) {
		const parsed = typeFlag(command?.flags ?? Object.create(null), [...argv]);
		const { _: args } = parsed;
		if (name === Root) {
			continue;
		}
		if (arrayStartsWith(args, name)) {
			return [command, name];
		}
	}
	if (commandsMap.has(Root)) {
		return [commandsMap.get(Root)!, Root];
	}

	return [undefined, undefined];
}

export const resolveArgv = (): string[] =>
	IS_NODE
		? process.argv.slice(IS_ELECTRON ? 1 : 2)
		: IS_DENO
		? // @ts-expect-error Ignore
		  Deno.args
		: [];

export function compose(inspectors: Inspector[]) {
	const inspectorMap = {
		pre: [] as InspectorFn[],
		normal: [] as InspectorFn[],
		post: [] as InspectorFn[],
	};
	for (const inspector of inspectors) {
		const objectInspector: InspectorObject =
			typeof inspector === "object" ? inspector : { fn: inspector };
		const { enforce, fn } = objectInspector;
		if (enforce === "post" || enforce === "pre") {
			inspectorMap[enforce].push(fn);
		} else {
			inspectorMap.normal.push(fn);
		}
	}

	const mergedInspectorFns = [
		...inspectorMap.pre,
		...inspectorMap.normal,
		...inspectorMap.post,
	];

	return (ctx: InspectorContext) => {
		return dispatch(0);
		function dispatch(i: number): void {
			const inspector = mergedInspectorFns[i];

			return inspector(ctx, dispatch.bind(null, i + 1));
		}
	};
}

const INVALID_RE = /\s{2,}/;
export const isValidName = (name: CommandType) =>
	name === Root
		? true
		: !(name.startsWith(" ") || name.endsWith(" ")) && !INVALID_RE.test(name);

export const withBrackets = (s: string, isOptional?: boolean) =>
	isOptional ? `[${s}]` : `<${s}>`;

const ROOT = "<Root>";
export const formatCommandName = (name: string | string[] | RootType) =>
	Array.isArray(name) ? name.join(" ") : typeof name === "string" ? name : ROOT;

export const detectLocale = () =>
	process.env.CLERC_LOCALE
		? process.env.CLERC_LOCALE
		: Intl.DateTimeFormat().resolvedOptions().locale;

export const stripFlags = (argv: string[]) =>
	argv.filter((arg) => !arg.startsWith("-"));
