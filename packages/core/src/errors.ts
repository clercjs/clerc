export class SingleCommandError extends Error {
  constructor () {
    super("Single command mode enabled.");
  }
}
export class SingleCommandAliasError extends Error {
  constructor () {
    super("Single command cannot have alias.");
  }
}
export class CommandExistsError extends Error {
  constructor (name: string) {
    super(`Command "${name}" exists.`);
  }
}
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
export class MultipleCommandsMatchedError extends Error {
  constructor (name: string) {
    super(`Multiple commands matched: ${name}`);
  }
}
export class CommandNameConflictError extends Error {
  constructor (n1: string, n2: string) {
    super(`Command name ${n1} conflicts with ${n2}. Maybe caused by alias.`);
  }
}
