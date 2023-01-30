import type { TranslateFn } from "./types";

export class CommandExistsError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("core.commandExists", commandName));
  }
}
export class NoSuchCommandError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("core.noSuchCommand", commandName));
  }
}
export class NoCommandGivenError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.noCommandGiven"));
  }
}
export class CommandNameConflictError extends Error {
  constructor(public n1: string, public n2: string, t: TranslateFn) {
    super(t("core.commandNameConflict", n1, n2));
  }
}
export class NameNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.nameNotSet"));
  }
}
export class DescriptionNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.descriptionNotSet"));
  }
}
export class VersionNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.versionNotSet"));
  }
}
export class InvalidCommandNameError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("core.badNameFormat", commandName));
  }
}
export class LocaleNotCalledFirstError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.localeMustBeCalledFirst"));
  }
}
