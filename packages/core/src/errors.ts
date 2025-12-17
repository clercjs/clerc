export class NoSuchCommandError extends Error {
	constructor(
		public commandName: string,
		text = `No such command: "${commandName}".`,
	) {
		super(text);
	}
}

export class NoCommandSpecifiedError extends Error {
	constructor(text = "No command specified.") {
		super(text);
	}
}

export class InvalidCommandError extends Error {}

export class MissingRequiredMetadataError extends Error {
	constructor(metadataName: string) {
		super(`CLI ${metadataName} is required.`);
	}
}

export class InvalidParametersError extends Error {}

export class MissingRequiredFlagError extends Error {
	constructor(flags: string[]) {
		const s = flags.length > 1 ? "s" : "";
		super(`Missing required flag${s}: ${flags.join(", ")}`);
	}
}
