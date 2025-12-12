import type { Plugin } from "vitepress";

const TAB_SIZE = 2;

// @keep-sorted
export const clercImports = [
	"Clerc",
	"Cli",
	"completionsPlugin",
	"friendlyErrorPlugin",
	"helpPlugin",
	"notFoundPlugin",
	"strictFlagsPlugin",
	"versionPlugin",
];

export const MarkdownTransform = (): Plugin => ({
	name: "clerc-markdown-transform",
	enforce: "pre",
	transform(code, id) {
		if (!id.endsWith(".md")) {
			return;
		}

		return code
			.replace(/```(ts|typescript)([^\n]*)\n/g, (match, lang, attrs) => {
				if (!attrs.includes("twoslash")) {
					attrs += " twoslash";
				}

				return `\`\`\`${lang}${attrs}\n// @include: imports\n`;
			})
			.replace(/\t/g, " ".repeat(TAB_SIZE));
	},
});
