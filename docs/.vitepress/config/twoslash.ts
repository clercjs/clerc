import path from "node:path";

import {
  rendererFloatingVue,
  transformerTwoslash,
} from "@shikijs/vitepress-twoslash";

import tsconfigBase from "../../../tsconfig.base.json" with { type: "json" };

const TWOSLASH_LANGS = new Set(["ts", "tsx", "typescript"]);
const NO_TWOSLASH_RE = /\bno-twoslash\b/;

export function createTwoslashTransformer() {
  const baseRenderer = rendererFloatingVue({
    queryRendering: "line",
  });

  const base = transformerTwoslash({
    explicitTrigger: false,
    renderer: {
      ...baseRenderer,
      // Queried tokens already render an inline box via lineQuery; leaving the
      // token plain avoids a duplicate hover popper and preserves arrow alignment.
      nodeQuery: (_query: unknown, node: any) => node,
    },
    twoslashOptions: {
      compilerOptions: {
        target: 99,
        module: 99,
        moduleResolution: 100,
        strict: true,
        paths: Object.fromEntries(
          Object.entries(tsconfigBase.compilerOptions.paths).map(
            ([key, targets]) => [key, targets.map((p) => path.join("..", p))],
          ),
        ),
      },
      handbookOptions: {
        noErrors: true,
      },
    },
  });

  return {
    ...base,
    preprocess(this: any, code: string, options: any) {
      const rawMeta =
        typeof options.meta?.__raw === "string" ? options.meta.__raw : "";
      if (!TWOSLASH_LANGS.has(options.lang) || NO_TWOSLASH_RE.test(rawMeta)) {
        return code;
      }

      return base.preprocess?.call(this, code, options);
    },
  };
}
