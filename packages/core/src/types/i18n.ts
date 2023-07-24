import type { Dict } from "@clerc/utils";

export type Locales = Dict<Dict<string>>;

export type TranslateFunction = (
	name: string,
	...arguments_: string[]
) => string | undefined;

export interface I18N {
	add: (locales: Locales) => void;
	t: TranslateFunction;
}
