import type { Dict } from "@clerc/utils";

export type Locales = Dict<Dict<string>>;

export type TranslateFn = (name: string, ...args: string[]) => string | undefined;

export interface I18N {
  add: (locales: Locales) => void;
  t: TranslateFn;
}
