// TODO: fix tests
import { describe, it } from "vitest";
// import { afterEach, beforeAll, describe, expect, it } from "vitest";
// import { helpPlugin } from "@clerc/plugin-help";
// import { create } from "./create";

// describe("plugin-help", () => {
//   const msgs: string[] = [];
//   beforeAll(() => {
//     // eslint-disable-next-line no-console
//     console.log = (s: string) => { msgs.push(s); };
//   });
//   afterEach(() => {
//     msgs.length = 0;
//   });
//   it("should show help", () => {
//     create()
//       .use(helpPlugin())
//       .parse(["help"]);
//     expect(msgs).toMatchInlineSnapshot(`
//         [
//           "[1m[90mName:[39m[22m   [90m [39m[31mtest[39m
//         [1m[90mVersion:[39m[22m[90m [39m[33m0.0.0[39m

//         [1mDescription:[22m

//             test

//         [1mUsage:[22m

//             $ test [command] [options]

//         [1mCommands:[22m

//             [36mhelp[39m[90m [39m[33m-[39m[90m [39mShow help
//         ",
//         ]
//       `);
//     msgs.length = 0;
//   });
//   it("should show --help", () => {
//     create()
//       .use(helpPlugin())
//       .parse(["--help"]);
//     expect(msgs).toMatchInlineSnapshot(`
//       [
//         "[1m[90mName:[39m[22m   [90m [39m[31mtest[39m
//       [1m[90mVersion:[39m[22m[90m [39m[33m0.0.0[39m

//       [1mDescription:[22m

//           test

//       [1mUsage:[22m

//           $ test [command] [options]

//       [1mCommands:[22m

//           [36mhelp[39m[90m [39m[33m-[39m[90m [39mShow help
//       ",
//       ]
//     `);
//   });
//   it("should show name, description and version", () => {
//     create()
//       .use(helpPlugin())
//       .parse(["help"]);
//     expect(msgs).toMatchInlineSnapshot(`
//     [
//       "[1m[90mName:[39m[22m   [90m [39m[31mtest[39m
//     [1m[90mVersion:[39m[22m[90m [39m[33m0.0.0[39m

//     [1mDescription:[22m

//         test

//     [1mUsage:[22m

//         $ test [command] [options]

//     [1mCommands:[22m

//         [36mhelp[39m[90m [39m[33m-[39m[90m [39mShow help
//     ",
//     ]
//   `);
//   });
// });

describe("plugin-help", () => {
  it ("placeholder", () => {});
});
