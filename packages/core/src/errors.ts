import type { TranslateFn } from "./types";

export class CommandExistsError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("commandExists", commandName));
  }
}
export class NoSuchCommandError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("noSuchCommand", commandName));
  }
}
export class NoCommandGivenError extends Error {
  constructor(t: TranslateFn) {
    super(t("noCommandGiven"));
  }
}
export class CommandNameConflictError extends Error {
  constructor(public n1: string, public n2: string, t: TranslateFn) {
    super(t("commandNameConflict", n1, n2));
  }
}
export class NameNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("nameNotSet"));
  }
}
export class DescriptionNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("descriptionNotSet"));
  }
}
export class VersionNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("versionNotSet"));
  }
}
export class InvalidCommandNameError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("badNameFormat", commandName));
  }
}
