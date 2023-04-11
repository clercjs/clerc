import type { Locales } from "./types";

export const locales: Locales = {
  "en": {
    "core.commandExists": "Command \"%s\" exists.",
    "core.noSuchCommand": "No such command: %s.",
    "core.noCommandGiven": "No command given.",
    "core.commandNameConflict": "Command name %s conflicts with %s. Maybe caused by alias.",
    "core.nameNotSet": "Name not set.",
    "core.descriptionNotSet": "Description not set.",
    "core.versionNotSet": "Version not set.",
    "core.badNameFormat": "Bad name format: %s.",
    "core.localeMustBeCalledFirst": "locale() or fallbackLocale() must be called at first.",
    "core.cliParseMustBeCalled": "cli.parse() must be called.",
    "core.spreadParameterMustBeLast": "Invalid Parameter: Spread parameter %s must be last.",
    "core.requiredParameterCannotComeAfterOptionalParameter":
      "Invalid Parameter: Required parameter %s cannot come after optional parameter %s.",
    "core.parameterMustBeWrappedInBrackets":
      "Invalid Parameter: Parameter %s must be wrapped in <> (required parameter) or [] (optional parameter).",
    "core.parameterIsUsedMoreThanOnce": "Invalid Parameter: Parameter %s is used more than once.",
    "core.missingRequiredParameter": "Missing required parameter %s.",
  },
  "zh-CN": {
    "core.commandExists": "命令 \"%s\" 已存在。",
    "core.noSuchCommand": "找不到命令: %s。",
    "core.noCommandGiven": "没有输入命令。",
    "core.commandNameConflict": "命令名称 %s 和 %s 冲突。 可能是由于别名导致的。",
    "core.nameNotSet": "未设置CLI名称。",
    "core.descriptionNotSet": "未设置CLI描述。",
    "core.versionNotSet": "未设置CLI版本。",
    "core.badNameFormat": "错误的命令名字格式: %s。",
    "core.localeMustBeCalledFirst": "locale() 或 fallbackLocale() 必须在最开始调用。",
    "core.cliParseMustBeCalled": "cli.parse() 必须被调用。",
    "core.spreadParameterMustBeLast": "不合法的参数: 展开参数 %s 必须在最后。",
    "core.requiredParameterCannotComeAfterOptionalParameter": "不合法的参数: 必填参数 %s 不能在可选参数 %s 之后。",
    "core.parameterMustBeWrappedInBrackets": "不合法的参数: 参数 %s 必须被 <> (必填参数) 或 [] (可选参数) 包裹。",
    "core.parameterIsUsedMoreThanOnce": "不合法的参数: 参数 %s 被使用了多次。",
    "core.missingRequiredParameter": "缺少必填参数 %s。",
  },
};
