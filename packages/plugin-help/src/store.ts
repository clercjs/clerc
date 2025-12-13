import type { Clerc, GroupsOptions } from "clerc";

declare module "@clerc/core" {
	export interface ContextStore {
		help: {
			addGroup: (options: GroupsOptions) => void;
		};
	}
}

export function addStoreApi(
	cli: Clerc,
	{ groups }: { groups: GroupsOptions },
): void {
	cli.store.help = {
		addGroup: (options: GroupsOptions) => {
			if (options.commands) {
				groups.commands = [...(groups.commands ?? []), ...options.commands];
			}
			if (options.flags) {
				groups.flags = [...(groups.flags ?? []), ...options.flags];
			}
			if (options.globalFlags) {
				groups.globalFlags = [
					...(groups.globalFlags ?? []),
					...options.globalFlags,
				];
			}
		},
	};
}
