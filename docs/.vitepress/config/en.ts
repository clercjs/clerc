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
		siteTitle: "Clerc Official Docs",
		nav: [
			{
				text: "Guide",
				link: "/getting-started",
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
						link: "/getting-started",
					},
					{
						text: "Commands",
						link: "/commands",
					},
					{
						text: "Context",
						link: "/context",
					},
					{
						text: "Flags",
						link: "/flags",
					},
					{
						text: "Global Flags",
						link: "/global-flags",
					},
					{
						text: "Interceptors",
						link: "/interceptors",
					},
					{
						text: "Plugins",
						link: "/plugins",
					},
					{
						text: "Error Handling",
						link: "/error-handling",
					},
					{
						text: "Advanced Usage",
						link: "/advanced",
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
			pattern: "https://github.com/clercjs/website/tree/main/docs/:path",
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
			copyright: "Copyright © 2023-present ClercJS",
		},
	},
});
