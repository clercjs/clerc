import { LiteEmit } from "lite-emit";
import type {
  CommandRecord,
  ConvertToEventMap,
  EnhanceCommands,
  EnhanceEnhancement,
  Enhancement,
  Handler,
  InternalCommand,
  Invoker,
  Middleware,
  ToRealCommandOrFlag,
} from "./types";

export class Clerc<
  N extends string,
  D extends string,
  C extends CommandRecord = {},
> {
  private emitter = new LiteEmit<ConvertToEventMap<C>>();

  _name = "" as N;
  _description = "" as D;
  _commands = {} as C;
  _invokers = [] as Invoker[];

  private constructor () {}

  static create () {
    return new Clerc();
  }

  name<Name extends string> (name: Name): Clerc<Name, D, C> {
    this._name = name as any;
    return this as any;
  }

  description<Desc extends string> (description: Desc): Clerc<N, Desc, C> {
    this._description = description as any;
    return this as any;
  }

  command<
    Name extends string,
    IComm extends InternalCommand<any>,
  > (name: Name, command: ToRealCommandOrFlag<IComm>): Clerc<N, D, EnhanceCommands<C, Name, IComm>> {
    this._commands[name] = command as any;
    return this as any;
  }

  on<Name extends keyof C> (name: Name, handler: Handler<C[Name]>) {
    this.emitter.on(name, (...args) => {
      const next: Invoker = (_cli, next) => {
        const invoker = this._invokers.shift();
        if (invoker) {
          invoker(this, next);
        } else {
          // @ts-expect-error That's OK
          handler(...args);
        }
      };
      next(this, next);
    });
    return this;
  }

  invoke (c: Invoker) {
    this._invokers.push(c);
  }

  use< E extends Enhancement>(m: Middleware<E>): EnhanceEnhancement< this, E > {
    return m(this) as any;
  }

  parse () {}
}

const a: Middleware<{
  commands: {
    a: {
      description: ""
      type: String
    }
    csdaf: {
      description: ""
      type: String
    }
  }
}> = (c) => {
  return c;
};

const _cli = Clerc.create()
  .name("foo")
  .description("1")
  .command("bar", {
    description: "2",
    type: Number,
    default: 1,
  })
  .command("fadf", {
    description: "",
    default: [1, 1],
    type: [Number],
    flags: {
      a: {
        description: "",
        type: String,
        default: 1,
        aliases: ["1"],
      },
    },
  })
  .use(a)
  .on("fadf", (_v, _a) => {});
