import { IS_DENO, IS_ELECTRON, IS_NODE } from "is-platform";

export const platformArgv: string[] = IS_NODE
  ? process.argv.slice(IS_ELECTRON ? 1 : 2)
  : IS_DENO
    ? // @ts-expect-error Ignore
      Deno.args
    : [];
