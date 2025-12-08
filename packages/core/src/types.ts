import type {
	FlagOptions,
	FlagType,
	IgnoreFunction,
	InferFlags,
	ParsedResult,
} from "@clerc/parser";
import type { MaybeArray, PartialRequired } from "@clerc/utils";

export type ParsingMode = "all" | "stop-at-positional" | "custom";

export interface CommandOptions<
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> {
	alias?: MaybeArray<string>;
	parameters?: Parameters;
	flags?: Flags;

	/**
	 * @default "all"
	 */
	mode?: ParsingMode;
	/**
	 * A callback function to conditionally stop parsing. When it returns true, parsing stops and remaining arguments are preserved in ignored.
	 * Only used when mode is set to "custom".
	 */
	ignore?: IgnoreFunction;
}

export interface Command<
	Name extends string = string,
	Parameters extends string[] = string[],
	Flags extends ClercFlagsDefinition = {},
> extends CommandOptions<Parameters, Flags> {
	name: Name;
	description: string;
}

export type CommandsRecord = Record<string, Command>;
export type CommandsMap = Map<string, Command>;
export type MakeEmitterEvents<Commands extends CommandsRecord> = {
	[K in keyof Commands]: [HandlerContext<Commands[K]>];
};

export type ClercFlagOptions = FlagOptions & {
	description: string;
};
export type ClercFlagDefinitionValue = ClercFlagOptions | FlagType;
export type ClercFlagsDefinition = Record<string, ClercFlagDefinitionValue>;

type InferFlagsFromMaybeUndefined<T extends ClercFlagsDefinition | undefined> =
	T extends undefined ? never : InferFlags<NonNullable<T>>;

export interface BaseContext<C extends Command = Command> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	rawParsed: ParsedResult<InferFlagsFromMaybeUndefined<C["flags"]>>;
}

export type HandlerContext<C extends Command> = PartialRequired<
	BaseContext<C>,
	"command" | "calledAs"
> & {
	resolved: true;
};

export type InterceptorContext<C extends Command = Command> = BaseContext<C>;

export type InterceptorNext = () => void | Promise<void>;

export type InterceptorHandler<C extends Command = Command> = (
	context: InterceptorContext<C>,
	next: InterceptorNext,
) => void | Promise<void>;

export interface InterceptorObject<C extends Command = Command> {
	enforce?: "pre" | "normal" | "post";
	handler: InterceptorHandler<C>;
}

export type Interceptor<C extends Command = Command> =
	| InterceptorHandler<C>
	| InterceptorObject<C>;
