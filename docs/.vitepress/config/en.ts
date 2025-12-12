import { join } from "node:path";

import { defineConfig } from "vitepress";

import { getNavigation } from "../utils/navigation";

const pluginNavigation = await getNavigation(
	join(import.meta.dirname, "..", "..", "official-plugins"),
	"/official-plugins",
);

export const enConfig = defineConfig({
	lang: "en-US",
	description: "The The full-featured Command-Line Interface library",
	themeConfig: {
		siteTitle: "Clerc Docs",
		nav: [
			{
				text: "Guide",
				link: "/guide/getting-started",
			},
			{
				text: "Official Plugins",
				items: pluginNavigation,
			},
			{
				text: "Members",
				link: "/members",
			},
		],
		sidebar: [
			{
				text: "Guide",
				items: [
					{
						text: "Getting Started",
						link: "/guide/getting-started",
					},
					{
						text: "Commands",
						link: "/guide/commands",
					},
					{
						text: "Context",
						link: "/guide/context",
					},
					{
						text: "Flags",
						link: "/guide/flags",
					},
					{
						text: "Global Flags",
						link: "/guide/global-flags",
					},
					{
						text: "Interceptors",
						link: "/guide/interceptors",
					},
					{
						text: "Plugins",
						link: "/guide/plugins",
					},
					{
						text: "Error Handling",
						link: "/guide/error-handling",
					},
					{
						text: "Advanced Usage",
						link: "/guide/advanced",
					},
				],
			},
			{
				text: "Official Plugins",
				items: pluginNavigation,
			},
		],
		editLink: {
			text: "Suggest to this page",
			pattern: "https://github.com/clercjs/clerc/tree/main/docs/:path",
		},
		outline: {
			label: "This page",
		},
		docFooter: {
			prev: "Previous",
			next: "Next",
		},
		footer: {
			message: "Released under the MIT license",
			copyright: "Copyright © 2023-present Clerc Developers",
		},
	},
});
