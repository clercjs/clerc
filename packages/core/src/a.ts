import { Clerc } from ".";

Clerc.create()
	.name("test cli")
	.scriptName("test-cli")
	.description("A test CLI application")
	.version("1.0.0")
	.command("", "", {})
	.command("foo bar", "", {
		flags: {
			a: {
				description: "Flag A",
				type: Boolean,
			},
			b: {
				description: "Flag B",
				type: String,
			},
		},
	})
	.on("foo bar", (ctx) => {
		ctx.flags.b;
		ctx.command.name;
		console.log(ctx);
	})
	.command("foo", "", {})
	.parse();
