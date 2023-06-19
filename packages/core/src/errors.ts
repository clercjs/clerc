import type { TranslateFn } from "./types";

const s = JSON.stringify;

export class CommandExistsError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("core.commandExists", s(commandName)));
  }
}
export class NoSuchCommandError extends Error {
  constructor(public commandName: string, t: TranslateFn) {
    super(t("core.noSuchCommand", s(commandName)));
  }
}
export class NoCommandGivenError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.noCommandGiven"));
  }
}
export class CommandNameConflictError extends Error {
  constructor(public n1: string, public n2: string, t: TranslateFn) {
    super(t("core.commandNameConflict", s(n1), s(n2)));
  }
}
export class ScriptNameNotSetError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.scriptNameNotSet"));
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
    super(t("core.badNameFormat", s(commandName)));
  }
}
export class LocaleNotCalledFirstError extends Error {
  constructor(t: TranslateFn) {
    super(t("core.localeMustBeCalledFirst"));
  }
}
