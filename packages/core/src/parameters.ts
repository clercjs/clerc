export function getParametersToResolve(argv: string[]): string[] {
	const parameters: string[] = [];

	for (const arg of argv) {
		if (arg.startsWith("-")) {
			break;
		}
		parameters.push(arg);
	}

	return parameters;
}
