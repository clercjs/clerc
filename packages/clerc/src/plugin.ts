import type { ScopeState } from "./scope";
import { Scope, getScopeState } from "./scope";

export function collectPluginStates(
  plugins: Iterable<Plugin<any, any>>,
): readonly ScopeState[] {
  const rootList = [...plugins];
  const winners = new Map<string, Plugin<any, any>>();
  const seen = new Set<Plugin<any, any>>();
  function scan(target: Plugin<any, any>): void {
    if (seen.has(target)) {
      return;
    }
    seen.add(target);
    for (const child of getScopeState(target).plugins.values()) {
      scan(child);
    }
    winners.set(target.pluginName, target);
  }
  for (const root of rootList) {
    scan(root);
  }

  const states: ScopeState[] = [];
  const visited = new Set<string>();
  function visit(target: Plugin<any, any>): void {
    if (visited.has(target.pluginName)) {
      return;
    }
    visited.add(target.pluginName);
    const winner = winners.get(target.pluginName)!;
    const state = getScopeState(winner);
    for (const child of state.plugins.values()) {
      visit(child);
    }
    states.push(state);
  }
  for (const root of rootList) {
    visit(root);
  }

  return states;
}

export class Plugin<
  TGlobalFlags extends Record<string, any> = {},
  TState extends Record<string, any> = {},
> extends Scope<TGlobalFlags, TState, "plugin"> {
  public readonly pluginName: string;

  constructor(name: string) {
    super();
    this.pluginName = name;
  }
}

export const plugin = (name: string): Plugin => new Plugin(name);
