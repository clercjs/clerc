import { Cli, Types, completionsPlugin, friendlyErrorPlugin } from "clerc";

Cli()
	.name("my-cli")
	.scriptName("my-cli")
	.version("1.0.0")
	.description("My CLI with completions")
	// 	.use(completionsPlugin())
	// 	.use(friendlyErrorPlugin())
	// 	.parse();
	// 啊离开了课件课件
	// 12313213123213
	.use(friendlyErrorPlugin())
	.use(completionsPlugin())
	.command("test", "Test command", {
		parameters: [
			"<param>",
			{
				key: "<param2>",
				type: Types.Enum("a", "b", "c"),
			},
			{
				key: "[range]",
				type: Types.Range(1, 10),
			},
		],
		flags: {
			bbb: {
				required: true,
				type: Types.Regex(/^a.*z$/, "starts with a ends with z"),
				alias: "a",
			},
		},
	})
	.parse();
