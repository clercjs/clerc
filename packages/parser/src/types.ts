export interface FlagOption {
	type: BooleanConstructor | StringConstructor | NumberConstructor;
	alias?: string | string[];
	description?: string;
}

export interface ParserOptions {
	flags: Record<string, FlagOption>;
}

export interface ParsedResult {
	flags: Record<string, any>;
	unknownFlags: Record<string, any>;
	_: string[];
}
