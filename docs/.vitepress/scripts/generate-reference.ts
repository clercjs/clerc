import { existsSync, readFileSync, readdirSync } from "node:fs";
import { cp, rename, rm } from "node:fs/promises";

import type { TypeDocOptions } from "typedoc";
import { Application } from "typedoc";

const LANGUAGES = ["zh"];
const IGNORED_PACKAGES = ["test-utils"];

export const PACKAGES = Object.fromEntries(
  readdirSync("../packages", { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !IGNORED_PACKAGES.includes(name))
    .map((name) => {
      const pkgPath = `../packages/${name}/package.json`;
      if (!existsSync(pkgPath)) {
        console.error(`package.json not found for package: ${name}`);

        return null;
      }
      const pkgJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

      return [name, pkgJson.name as string] as const;
    })
    .filter((x): x is [string, string] => !!x)
    .toSorted(([a], [b]) => a.localeCompare(b)),
);

const tsconfig = "../tsconfig.json";

if (import.meta.main) {
  console.log("📚 Generating reference...");

  // Clean up previous reference
  await rm("reference/api", { recursive: true, force: true });

  // Generate API documentation
  for (const [pkg, name] of Object.entries(PACKAGES)) {
    console.log(`📚 Generating reference for ${name}...`);
    await runTypedoc(tsconfig, pkg);
  }
  console.log("✅ Reference generated successfully!");
  console.log("📚 Beautifying reference structure...");

  for (const pkg of Object.keys(PACKAGES)) {
    if (existsSync(`reference/api/${pkg}/globals.md`)) {
      await rm(`reference/api/${pkg}/index.md`, { force: true });
      await rename(
        `reference/api/${pkg}/globals.md`,
        `reference/api/${pkg}/index.md`,
      );
    }
    await rm(`reference/api/${pkg}/_media`, { recursive: true, force: true });
  }

  for (const language of LANGUAGES) {
    await rm(`${language}/reference/api`, { recursive: true, force: true });
    await cp("reference/api", `${language}/reference/api`, {
      recursive: true,
      force: true,
    });
  }

  /**
   * Run TypeDoc with the specified tsconfig
   */
  async function runTypedoc(tsconfig: string, pkg: string): Promise<void> {
    const options: TypeDocOptions &
      import("typedoc-plugin-markdown").PluginOptions = {
      tsconfig,
      plugin: ["typedoc-plugin-markdown", "typedoc-vitepress-theme"],
      out: `./reference/api/${pkg}`,
      entryPoints: [`../packages/${pkg}/src/index.ts`],
      excludeInternal: true,

      hideBreadcrumbs: true,
      useCodeBlocks: true,
      formatWithPrettier: true,
      flattenOutputFiles: true,

      indexFormat: "htmlTable",
      parametersFormat: "htmlTable",
      interfacePropertiesFormat: "htmlTable",
      classPropertiesFormat: "htmlTable",
      propertyMembersFormat: "htmlTable",
      typeDeclarationFormat: "htmlTable",
      typeAliasPropertiesFormat: "htmlTable",
      enumMembersFormat: "htmlTable",

      // @ts-expect-error VitePress config
      docsRoot: "./reference",
    };
    const app = await Application.bootstrapWithPlugins(options);

    // May be undefined if errors are encountered.
    const project = await app.convert();

    if (project) {
      // Generate configured outputs
      await app.generateOutputs(project);
    } else {
      throw new Error(`Failed to generate TypeDoc output for ${pkg}`);
    }
  }
}
