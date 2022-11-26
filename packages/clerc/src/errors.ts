export class SingleCommandError extends Error {
  constructor () {
    super("Single command mode enabled.");
  }
}
export class CommandExistsError extends Error {}
export class CommonCommandExistsError extends Error {
  constructor () {
    super("Common command exists.");
  }
}
export class NoSuchCommandError extends Error {
  constructor (name: string) {
    super(`No such command: ${name}`);
  }
}
export class ParentCommandExistsError extends Error {
  constructor (name: string) {
    super(`Command "${name}" cannot exist with its parent`);
  }
}

export class SubcommandExistsError extends Error {
  constructor (name: string) {
    super(`Command "${name}" cannot exist with its subcommand`);
  }
}
