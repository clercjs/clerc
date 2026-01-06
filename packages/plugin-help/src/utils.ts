import type { FlagDefaultValue, TypeValue } from "@clerc/parser";

export function formatTypeValue(type: TypeValue): string {
  if (typeof type === "function") {
    return type.display ?? type.name;
  }

  const innerType = type[0] as any;

  return `Array<${innerType.displayName ?? innerType.name}>`;
}

export function formatFlagDefault<T>(value: FlagDefaultValue<T>): string {
  if (typeof value === "function" && "display" in value && value.display) {
    return value.display;
  }

  return JSON.stringify(value);
}

export function formatCommandName(name: string): string {
  if (name === "") {
    return "(root)";
  }

  return name;
}
