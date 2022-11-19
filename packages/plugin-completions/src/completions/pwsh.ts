import type { Command, HandlerContext } from "clerc";
import { gracefulFlagName, mustArray } from "@clerc/utils";

const getCompletionValue = (command: Command) => `[CompletionResult]::new('${command.name}', '${command.name}', [CompletionResultType]::ParameterValue, '${command.description}')`;
const getCompletionFlag = (command: Command) => {
  return Object.entries(command.flags || {})
    .map(([flagName, flag]) => {
      const gen = [`[CompletionResult]::new('${gracefulFlagName(flagName)}', '${flagName}', [CompletionResultType]::ParameterName, '${command.flags![flagName].description || ""}')`];
      if (flag?.alias) {
        const arrayAlias = mustArray(flag.alias);
        gen.push(
          ...arrayAlias.map(n => `[CompletionResult]::new('${gracefulFlagName(n)}', '${n}', [CompletionResultType]::ParameterName, '${command.flags![flagName].description || ""}')`),
        );
      }
      return gen.join("\n            ");
    })
    .join("\n            ");
};

export const getPwshCompletion = (ctx: HandlerContext) => {
  const { cli } = ctx;
  const { _name: name, _commands: commands } = cli;
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
          `'${name};${commandName}' {
            ${getCompletionFlag(command)}
            break
        }`).join("\n        ")
        }
    })

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}`;
};
