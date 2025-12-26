import type { FlagDefaultValue, TypeValue } from "@clerc/parser";

export interface Formatters {
	formatTypeValue: (type: TypeValue) => string;
	formatFlagDefault: <T>(value: FlagDefaultValue<T>) => string;
}

/**
 * A group definition as a tuple of [key, displayName]. The key is used in help
 * options to assign items to groups. The displayName is shown in the help
 * output.
 */
export type GroupDefinition = [key: string, name: string];

/**
 * Options for defining groups in help output.
 */
export interface GroupsOptions {
	/**
	 * Groups for commands. Each group is defined as `[key, name]`.
	 */
	commands?: GroupDefinition[];
	/**
	 * Groups for command-specific flags. Each group is defined as `[key, name]`.
	 */
	flags?: GroupDefinition[];
	/**
	 * Groups for global flags. Each group is defined as `[key, name]`.
	 */
	globalFlags?: GroupDefinition[];
}
