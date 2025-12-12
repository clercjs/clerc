import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import UnoCSS from "unocss/vite";
import type { DefaultTheme } from "vitepress";
import { defineConfig } from "vitepress";
import {
	groupIconMdPlugin,
	groupIconVitePlugin,
} from "vitepress-plugin-group-icons";

import tsconfigBase from "../../../tsconfig.base.json" with { type: "json" };
import { MarkdownTransform, clercImports } from "../plugins/markdown-transform";

const flattenItems = (
	items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] =>
	items
		.flatMap((item) => {
			if (item.items && !item.link) {
				return flattenItems(item.items);
			}

			if (item.items) {
				return {
					...item,
					items: flattenItems(item.items),
				};
			}

			return item;
		})
		.toSorted((a, b) => a.text!.localeCompare(b.text!));

export function getTypedocSidebar(pkg: string) {
	const filepath = path.resolve(
		import.meta.dirname,
		`../../reference/api/${pkg}/typedoc-sidebar.json`,
	);
	if (!existsSync(filepath)) {
		return [];
	}

	try {
		const items = JSON.parse(
			readFileSync(filepath, "utf-8"),
		) as DefaultTheme.SidebarItem[];

		return flattenItems(items);
	} catch (error) {
		console.error(`Failed to load typedoc sidebar for ${pkg}:`, error);

		return [];
	}
}

export const sharedConfig = defineConfig({
	title: "Clerc",
	// appearance: "dark",
	lastUpdated: true,
	head: [["link", { rel: "icon", href: "/logo.webp", type: "image/webp" }]],
	themeConfig: {
		logo: {
			light: "/black.webp",
			dark: "/white.webp",
		},
		outline: [2, 3],
		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/clercjs/clerc",
			},
		],
		search: {
			provider: "local",
		},
	},
	markdown: {
		config(md) {
			md.use(groupIconMdPlugin);
		},
		codeTransformers: [
			transformerTwoslash({
				twoslashOptions: {
					compilerOptions: {
						paths: Object.fromEntries(
							Object.entries(tsconfigBase.compilerOptions.paths).map(
								([key, paths]) => [key, paths.map(p=>p.join("..", source))],
							),
						),
					},
					handbookOptions: {
						noErrors: true,
					},
				},
				includesMap: new Map([
					[
						"imports",
						`// ---cut-start---\nimport { ${clercImports.join(", ")} } from "clerc";\n// ---cut-end---`,
					],
				]),
				// typesCache: createFileSystemTypesCache(),
			}),
		],
		languages: ["js", "jsx", "ts", "tsx"],
	},
	vite: {
		plugins: [groupIconVitePlugin(), UnoCSS(), MarkdownTransform()],
	},
});
