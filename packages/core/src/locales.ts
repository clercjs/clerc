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
  },
};
