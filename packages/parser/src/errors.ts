export class InvalidSchemaError extends Error {
	constructor(message: string) {
		super(`Invalid schema: ${message}`);
		this.name = "InvalidSchemaError";
	}
}

export class MissingRequiredFlagError extends Error {
	constructor(name: string) {
		super(`Missing required flag: ${name}`);
		this.name = "MissingRequiredFlagError";
	}
}
