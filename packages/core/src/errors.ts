export class CommandExistsError extends Error {
  constructor(public commandName: string) {
    super(`Command "${commandName}" exists.`);
  }
}
export class NoSuchCommandError extends Error {
  constructor(public commandName: string) {
    super(`No such command: ${commandName}`);
  }
}
export class NoCommandGivenError extends Error {
  constructor() {
    super("No command given.");
  }
}
export class CommandNameConflictError extends Error {
  constructor(public n1: string, public n2: string) {
    super(`Command name ${n1} conflicts with ${n2}. Maybe caused by alias.`);
  }
}
export class NameNotSetError extends Error {
  constructor() {
    super("Name not set.");
  }
}
export class DescriptionNotSetError extends Error {
  constructor() {
    super("Description not set.");
  }
}
export class VersionNotSetError extends Error {
  constructor() {
    super("Version not set.");
  }
}
export class InvalidCommandNameError extends Error {
  constructor(public commandName: string) {
    super(`Bad name format: ${commandName}`);
  }
}
