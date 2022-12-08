// TODO
import type { HandlerContext } from "@clerc/core";

const generateCommandCompletion = (name: string) => `
            ${name})
                cmd+="__${name}"
                ;;`;

export const getBashCompletion = (ctx: HandlerContext) => {
  const { cli } = ctx;
  const { _name: name, _commands: commands } = cli;
  return `_${name}() {
    local i cur prev opts cmds
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    cmd=""
    opts=""

    for i in \${COMP_WORDS[@]}
    do
        case "\${i}" in
            "$1")
                cmd="${name}"
                ;;
${Object.keys(commands).map(generateCommandCompletion).join("")}
            *)
                ;;
        esac
    done
}

complete -F _${name} -o bashdefault -o default ${name}
`;
};
