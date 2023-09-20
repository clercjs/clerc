import { Clerc } from "clerc";

Clerc.create("foo", "A foo CLI", "0.0.0")
	.command("bar", "A bar command")
	.on("bar", (_ctx) => {
		console.log("Hello, world from Clerc.js!");
	})
	.parse();
