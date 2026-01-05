import type { ObjectInputType, TypeFunction } from "./types";

export const OBJECT_TYPE_MARKER: unique symbol = Symbol("objectType");

export interface ObjectTypeConfig<T = any> {
  /**
   * Optional custom value setter function. If not provided, uses default
   * behavior (appendDotValues - converts duplicate keys to arrays).
   */
  setValue?: (object: any, path: string, value: string) => void;

  /**
   * Custom merge function to combine external default values with user-provided
   * values. By default, performs a shallow merge (assigns top-level properties
   * from default that don't exist in user object).
   *
   * @param target The user-provided object
   * @param defaults The external default values to merge
   */
  mergeObject?: (target: T, defaults: any) => void;
}

/**
 * A special TypeFunction that supports dot-notation and context-aware value
 * setting.
 */
export interface ObjectTypeFunction<T = ObjectInputType>
  extends ObjectTypeConfig<T>, TypeFunction<T> {
  [OBJECT_TYPE_MARKER]: true;
}

/**
 * Create an ObjectType with optional custom value setter and merge function.
 *
 * @example
 *
 * ```ts
 * // Default behavior (array support for duplicate keys)
 * flags: {
 *   env: objectType();
 * }
 *
 * // With external default (will merge with user values using shallow merge)
 * flags: {
 *   config: {
 *     type: objectType(),
 *     default: { PORT: 3000, HOST: "localhost" }
 *   }
 * }
 *
 * // Custom type conversion
 * flags: {
 *   env: objectType({
 *     setValue: (object, path, value) => {
 *       if (path === "PORT") {
 *         setDotValues(object, path, Number(value));
 *       } else {
 *         setDotValues(object, path, coerceObjectValue(value));
 *       }
 *     }
 *   });
 * }
 *
 * // Custom merge function for external default
 * flags: {
 *   config: {
 *     type: objectType({
 *       mergeObject: (target, defaults) => {
 *         // Custom deep merge logic
 *         for (const [key, val] of Object.entries(defaults)) {
 *           if (typeof val === 'object' && typeof target[key] === 'object') {
 *             Object.assign(target[key], val, target[key]);
 *           } else if (!(key in target)) {
 *             target[key] = val;
 *           }
 *         }
 *       }
 *     }),
 *     default: { PORT: 3000, nested: { foo: 'bar' } }
 *   }
 * }
 * ```
 *
 * @template T The type of the resulting object
 * @param config Optional configuration object
 * @returns An ObjectTypeFunction that can be used as a flag type
 */
export function objectType<T = ObjectInputType>(
  config?: ObjectTypeConfig<T>,
): ObjectTypeFunction<NoInfer<T>> {
  const fn = (() => {
    throw new Error(
      "ObjectType should not be called as a regular TypeFunction. " +
        "This is likely an internal parser bug.",
    );
  }) as unknown as ObjectTypeFunction<T>;

  fn[OBJECT_TYPE_MARKER] = true;

  if (config) {
    Object.assign(fn, config);
  }

  return fn;
}

export const isObjectType = (value: any): value is ObjectTypeFunction =>
  typeof value === "function" && Object.hasOwn(value, OBJECT_TYPE_MARKER);
