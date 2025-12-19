import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("interceptors", () => {
	it("should handle interceptor", () => {
		let count = 0;
		TestBaseCli()
			.command("foo", "foo")
			.interceptor(() => {})
			.on("foo", () => {
				count++;
			})
			.parse(["foo"]);

		expect(count).toBe(0);
	});

	it("should next", () => {
		let count = 0;
		TestBaseCli()
			.command("foo", "foo")
			.interceptor(async (_ctx, next) => {
				await next();
			})
			.interceptor(async (ctx, next) => {
				expect(ctx.command?.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({});

				await next();
			})
			.on("foo", () => {
				count++;
			})
			.parse(["foo"]);

		expect(count).toBe(1);
	});
});
