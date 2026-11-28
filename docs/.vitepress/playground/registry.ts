import type { PlaygroundScenario } from "./runtime.ts";

type PlaygroundModule = Readonly<Record<string, PlaygroundScenario>>;

const globModules = import.meta.glob<PlaygroundModule>([
  "../../guide/*.playground.ts",
  "../../official-plugins/*.playground.ts",
]);

const loadersByFile = new Map<string, () => Promise<PlaygroundModule>>();

for (const [modulePath, loader] of Object.entries(globModules)) {
  const match = /\/([^/]+)\.playground\.ts$/.exec(modulePath);
  if (match) {
    loadersByFile.set(match[1], loader);
  }
}

export async function loadPlayground(
  demo: string,
): Promise<PlaygroundScenario> {
  const [fileKey, exportName = "default"] = demo.split("/");
  const loader = loadersByFile.get(fileKey);
  if (!loader) {
    throw new Error(`Unknown playground module: "${fileKey}" (demo="${demo}")`);
  }
  const mod = await loader();
  const scenario = mod[exportName];
  if (!scenario) {
    throw new Error(
      `Unknown playground export "${exportName}" in "${fileKey}.playground.ts"`,
    );
  }

  return scenario;
}
