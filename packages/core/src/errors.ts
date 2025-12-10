export class NoSuchCommandError extends Error {
	constructor(public commandName: string) {
		super(`No such command: "${commandName}".`);
	}
}

export class NoCommandGivenError extends Error {
	constructor() {
		super("No command specified.");
	}
}

export class InvalidCommandError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export class MissingRequiredMetadataError extends Error {
	constructor(metadataName: string) {
		super(`CLI ${metadataName} is required.`);
	}
}

export class InvalidParametersError extends Error {
	constructor(message: string) {
		super(message);
	}
}
