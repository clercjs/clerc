import { Clerc } from "clerc";

Clerc.create()
	.name("foo")
	.scriptName("foo-cli")
	.description("A foo CLI")
	.version("0.0.0")
	.command("bar", "A bar command")
	.on("bar", (_ctx) => {
		console.log("Hello, world from Clerc!");
	})
	.parse();
