# Clerc

Clerc is a simple and easy-to-use cli framework.

## 💎 Features
- Super tiny
- Plugin system
- Chainable APIs
- Strongly typed
- Parses arguments
- Extensible with plugins
- Converts flags to camelCase
- Outputs description and supplied help text when `help` or `--help` (via [@clerc/plugin-help](./packages/plugin-help/))
- Completions (via [@clerc/plugin-completions](./packages/plugin-completions/))
- Not found info (via [@clerc/plugin-not-found](./packages/plugin-not-found/))

## 📦 Installation

```bash
$ npm install clerc
$ yarn add clerc
$ pnpm add clerc
```

## 🚀 Usage

```bash
$ node ./foo-cli.mjs foo --bar
```

```js
import { Clerc } from "clerc";
import { helpPlugin } from "@clerc/plugin-help";

const cli = Clerc.create()
  .name("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .use(helpPlugin()) // Uses help plugin
  .command("foo", "A foo command")
  .on("foo", (ctx) => {
    console.log(ctx);
    /*
      {
        name: 'foo',
        resolved: true,
        isSingleCommand: false,
        raw: { flags: { bar: true }, unknownFlags: {}, _: [ 'foo', '--': [] ] },
        parameters: [],
        flags: { bar: true },
        cli: ...
      }
    */
  })
  .parse();
```

## 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)