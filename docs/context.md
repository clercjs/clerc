# Context

The context is the object that is passed to every command.

## Handler Context

The handler context is the context that is passed to every handler.

### Properties

#### `name`

The name of the command that was called.

#### `called`

The name of the command that was called. This is the same as `name` except when the command is an alias. In that case, `called` is the name of the alias and `name` is the name of the command.

#### `resolved`

Whether or not the command was resolved. This is `false` when the command was not resolved (i.e. the command was not found). This is always true when the context is a handler context.

#### `hasRootOrAlias`

Whether or not the cli has a root command or a command which has an alias of the root command.

#### `hasRoot`

Whether or not the cli has a root command.

#### `raw`

##### `_`

The raw arguments passed to the command.

##### `flags`

The flags passed to the command.

##### `unknownFlags`

The unknown flags passed to the command.

##### `parameters`

The parameters passed to the command.

##### `mergedFlags`

The merged flags (`flags & unknownFlags`) passed to the command.

#### `flags`

The normalized flags.

#### `parameters`

The normalized parameters.

#### `unknownFlags`

The unknown flags passed to the command.

#### `cli`

The Clerc instance.

## Inspector Context

The same as handler context.
