export class CommandExistsError extends Error {
  constructor(name: string) {
    super(`Command "${name}" exists.`);
  }
}
export class NoSuchCommandError extends Error {
  constructor(name: string) {
    super(`No such command: ${name}`);
  }
}
export class NoCommandGivenError extends Error {
  constructor() {
    super("No command given.");
  }
}
export class CommandNameConflictError extends Error {
  constructor(n1: string, n2: string) {
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
  constructor(name: string) {
    super(`Bad name format: ${name}`);
  }
}
