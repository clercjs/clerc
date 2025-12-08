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
		},
	})
	.on("foo bar", (ctx) => {})
	.command("foo", "", {})
	.parse();
