export class InvalidSchemaError extends Error {
	constructor(message: string) {
		super(`Invalid schema: ${message}`);
		this.name = "InvalidSchemaError";
	}
}
