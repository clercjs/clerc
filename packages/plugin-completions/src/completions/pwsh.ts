import type { Command, HandlerContext } from "@clerc/core";
import { gracefulFlagName, kebabCase } from "@clerc/utils";

const NO_DESCRIPTION = "(No Description)";
const getCompletionValue = (command: Command) =>
  `[CompletionResult]::new('${command.name}', '${command.name}', [CompletionResultType]::ParameterValue, '${command.description}')`;
const getCompletionFlag = (command: Command) => {
  return Object.entries(command.flags ?? {})
    .map(([flagName, flag]) => {
      const gen = [
        `[CompletionResult]::new('${gracefulFlagName(flagName)}', '${
          kebabCase(flagName)
        }', [CompletionResultType]::ParameterName, '${command.flags![flagName].description || NO_DESCRIPTION}')`,
      ];
      if (flag?.alias) {
        gen.push(
          `[CompletionResult]::new('${
            gracefulFlagName(flag.alias)
          }', '${flag.alias}', [CompletionResultType]::ParameterName, '${
            command.flags![flagName].description || NO_DESCRIPTION
          }')`,
        );
      }
      return gen.join("\n            ");
    })
    .join("\n            ");
};

export const getPwshCompletion = (ctx: HandlerContext) => {
  const { cli } = ctx;
  const { _scriptName: name, _commands: commands } = cli;
  return `using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName '${name}' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $command = @(
        '${name}'
        for ($i = 1; $i -lt $commandElements.Count; $i++) {
            $element = $commandElements[$i]
            if ($element -isnot [StringConstantExpressionAst] -or
                $element.StringConstantType -ne [StringConstantType]::BareWord -or
                $element.Value.StartsWith('-') -or
                $element.Value -eq $wordToComplete) {
                break
        }
        $element.Value
    }) -join ';'

    $completions = @(switch ($command) {
        '${name}' {
            ${Object.entries(commands).map(([_, command]) => getCompletionValue(command)).join("\n            ")}
            break
        }
        ${
    Object.entries(commands).map(([commandName, command]) =>
      `'${name};${commandName.split(" ").join(";")}' {
            ${getCompletionFlag(command)}
            break
        }`
    ).join("\n        ")
  }
    })

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}`;
};
