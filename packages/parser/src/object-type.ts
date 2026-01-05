import type { ObjectInputType, TypeFunction } from "./types";

export const OBJECT_TYPE_MARKER = Symbol("objectType");

/**
 * A special TypeFunction that supports dot-notation and context-aware value
 * setting.
 */
export interface ObjectTypeFunction<
  T = ObjectInputType,
> extends TypeFunction<T> {
  [OBJECT_TYPE_MARKER]: true;

  /**
   * Optional custom value setter function. If not provided, uses default
   * behavior (appendDotValues - converts duplicate keys to arrays).
   */
  setValue?: (object: any, path: string, value: string) => void;
}

/**
 * Create an ObjectType with optional custom value setter.
 *
 * @example
 *
 * ```ts
 * // Default behavior (array support for duplicate keys)
 * flags: {
 *   env: objectType();
 * }
 *
 * // Custom type conversion
 * flags: {
 *   env: objectType<{ PORT: number }>((object, path, value) => {
 *     if (path === "PORT") {
 *       setDotValues(object, path, Number(value));
 *     } else {
 *       setDotValues(object, path, coerceObjectValue(value));
 *     }
 *   });
 * }
 * ```
 *
 * @template T The type of the resulting object
 * @param setValue Optional custom function to set values
 * @returns An ObjectTypeFunction that can be used as a flag type
 */
export function objectType<T = ObjectInputType>(
  setValue?: (object: any, path: string, value: string) => void,
): ObjectTypeFunction<NoInfer<T>> {
  const fn = (() => {
    throw new Error(
      "ObjectType should not be called as a regular TypeFunction. " +
        "This is likely an internal parser bug.",
    );
  }) as unknown as ObjectTypeFunction<T>;

  fn[OBJECT_TYPE_MARKER] = true;
  fn.setValue = setValue;

  return fn;
}

export const isObjectType = (value: any): value is ObjectTypeFunction =>
  typeof value === "function" && Object.hasOwn(value, OBJECT_TYPE_MARKER);
