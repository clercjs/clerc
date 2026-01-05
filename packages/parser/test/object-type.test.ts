import { describe, expect, it } from "vitest";

import {
  appendDotValues,
  coerceObjectValue,
  objectType,
  parse,
  setDotValues,
} from "../src";

describe("parser - objectType", () => {
  describe("default behavior", () => {
    it("should handle dot-nested options with default coercion", () => {
      const { flags } = parse(
        [
          "--env.PORT",
          "3000",
          "--env.DEBUG",
          "--env.ENABLED",
          "true",
          "--env.DISABLED",
          "false",
        ],
        {
          flags: {
            env: objectType(),
          },
        },
      );

      expect(flags).toEqual({
        env: {
          PORT: "3000",
          DEBUG: true, // empty value coerced to true
          ENABLED: true,
          DISABLED: false,
        },
      });
    });

    it("should handle duplicate keys by converting to arrays", () => {
      const { flags } = parse(
        ["--env.TAGS", "a", "--env.TAGS", "b", "--env.TAGS", "c"],
        {
          flags: {
            env: objectType(),
          },
        },
      );

      expect(flags).toEqual({
        env: {
          TAGS: ["a", "b", "c"],
        },
      });
    });

    it("should handle mixed single and array values", () => {
      const { flags } = parse(
        [
          "--env.PORT",
          "3000",
          "--env.TAGS",
          "a",
          "--env.TAGS",
          "b",
          "--env.DEBUG",
        ],
        {
          flags: {
            env: objectType(),
          },
        },
      );

      expect(flags).toEqual({
        env: {
          PORT: "3000",
          TAGS: ["a", "b"],
          DEBUG: true,
        },
      });
    });

    it("should handle external default - merge when user provides values", () => {
      // External default should merge with user-provided values
      const { flags } = parse(["--env.PORT", "1145"], {
        flags: {
          env: {
            type: objectType(),
            default: { PORT: "8080", DEBUG: false },
          },
        },
      });

      expect(flags).toEqual({
        env: {
          PORT: "1145",
          DEBUG: false, // Merged from default
        },
      });
    });

    it("should handle nested paths", () => {
      const { flags } = parse(
        [
          "--config.db.host",
          "localhost",
          "--config.db.port",
          "5432",
          "--config.api.enabled",
        ],
        {
          flags: {
            config: objectType(),
          },
        },
      );

      expect(flags).toEqual({
        config: {
          db: {
            host: "localhost",
            port: "5432",
          },
          api: {
            enabled: true,
          },
        },
      });
    });
  });

  describe("custom setValue", () => {
    it("should allow custom type conversion", () => {
      const { flags } = parse(
        ["--env.PORT", "3000", "--env.DEBUG", "true", "--env.NAME", "app"],
        {
          flags: {
            env: objectType<{ PORT: number; DEBUG: boolean; NAME: string }>({
              setValue: (object, path, value) => {
                if (path === "PORT") {
                  setDotValues(object, path, Number(value));
                } else if (path === "DEBUG") {
                  setDotValues(object, path, value === "true");
                } else {
                  setDotValues(object, path, value);
                }
              },
            }),
          },
        },
      );

      expect(flags).toEqual({
        env: {
          PORT: 3000, // converted to number
          DEBUG: true, // converted to boolean
          NAME: "app", // kept as string
        },
      });
    });

    it("should support manual array handling with appendDotValues", () => {
      const { flags } = parse(
        [
          "--env.HOSTS",
          "localhost",
          "--env.HOSTS",
          "example.com",
          "--env.PORT",
          "3000",
        ],
        {
          flags: {
            env: objectType({
              setValue: (object, path, value) => {
                if (path === "HOSTS") {
                  // Use appendDotValues for array behavior
                  appendDotValues(object, path, value);
                } else if (path === "PORT") {
                  setDotValues(object, path, Number(value));
                } else {
                  setDotValues(object, path, coerceObjectValue(value));
                }
              },
            }),
          },
        },
      );

      expect(flags).toEqual({
        env: {
          HOSTS: ["localhost", "example.com"],
          PORT: 3000,
        },
      });
    });
  });

  describe("backward compatibility", () => {
    it("should still support type: Object syntax with new array behavior", () => {
      const { flags } = parse(
        ["--env.TAGS", "a", "--env.TAGS", "b", "--env.PORT", "3000"],
        {
          flags: {
            env: { type: Object },
          },
        },
      );

      expect(flags).toEqual({
        env: {
          TAGS: ["a", "b"],
          PORT: "3000",
        },
      });
    });

    it("should handle Object shorthand with array behavior", () => {
      const { flags } = parse(["--config.hosts", "a", "--config.hosts", "b"], {
        flags: {
          config: Object,
        },
      });

      expect(flags).toEqual({
        config: {
          hosts: ["a", "b"],
        },
      });
    });

    it("should merge external default for plain Object type", () => {
      const { flags } = parse(["--env.PORT", "8080"], {
        flags: {
          env: {
            type: Object,
            default: { PORT: "3000", HOST: "localhost", DEBUG: false },
          },
        },
      });

      expect(flags).toEqual({
        env: {
          PORT: "8080",
          HOST: "localhost",
          DEBUG: false,
        },
      });
    });

    it("should use all defaults when no Object values provided", () => {
      const { flags } = parse([], {
        flags: {
          env: {
            type: Object,
            default: { PORT: "3000", HOST: "localhost" },
          },
        },
      });

      expect(flags).toEqual({
        env: {
          PORT: "3000",
          HOST: "localhost",
        },
      });
    });

    it("should merge multiple user values with Object default", () => {
      const { flags } = parse(["--env.PORT", "8080", "--env.DEBUG", "true"], {
        flags: {
          env: {
            type: Object,
            default: { PORT: "3000", HOST: "localhost", TIMEOUT: "30" },
          },
        },
      });

      expect(flags).toEqual({
        env: {
          PORT: "8080",
          DEBUG: true,
          HOST: "localhost",
          TIMEOUT: "30",
        },
      });
    });
  });

  describe("utility functions", () => {
    it("setDotValues should set values without type conversion", () => {
      const obj = {};
      setDotValues(obj, "foo.bar", "3000");
      setDotValues(obj, "enabled", "true");

      expect(obj).toEqual({
        foo: { bar: "3000" },
        enabled: "true", // no coercion
      });
    });

    it("setDotValues should overwrite existing values", () => {
      const obj: any = {};
      setDotValues(obj, "foo", "first");
      setDotValues(obj, "foo", "second");

      expect(obj).toEqual({
        foo: "second",
      });
    });

    it("appendDotValues should handle duplicate keys by creating arrays", () => {
      const obj = {};
      appendDotValues(obj, "tags", "a");
      appendDotValues(obj, "tags", "b");
      appendDotValues(obj, "tags", "c");

      expect(obj).toEqual({
        tags: ["a", "b", "c"],
      });
    });

    it("appendDotValues should work with nested paths", () => {
      const obj = {};
      appendDotValues(obj, "config.hosts", "localhost");
      appendDotValues(obj, "config.hosts", "example.com");

      expect(obj).toEqual({
        config: {
          hosts: ["localhost", "example.com"],
        },
      });
    });

    it("coerceObjectValue should convert true/false strings", () => {
      expect(coerceObjectValue("true")).toBeTruthy();
      expect(coerceObjectValue("false")).toBeFalsy();
      expect(coerceObjectValue("")).toBeTruthy();
      expect(coerceObjectValue("hello")).toBe("hello");
      expect(coerceObjectValue("123")).toBe("123");
    });
  });

  describe("edge cases", () => {
    it("should handle path conflicts (primitive vs object)", () => {
      const { flags } = parse(
        ["--config.port", "8080", "--config.port.internal", "9090"],
        {
          flags: {
            config: objectType(),
          },
        },
      );

      // The nested path is ignored because port is already a primitive
      expect(flags).toEqual({
        config: { port: "8080" },
      });
    });

    it("should handle empty object", () => {
      const { flags } = parse([], {
        flags: {
          env: objectType(),
        },
      });

      expect(flags).toEqual({
        env: {},
      });
    });

    it("should work with colon delimiters", () => {
      const { flags } = parse(["--config.port:8080", "--config.enabled"], {
        flags: {
          config: objectType(),
        },
      });

      expect(flags).toEqual({
        config: {
          port: "8080",
          enabled: true,
        },
      });
    });
  });

  describe("default values", () => {
    it("should use external default when no value is provided", () => {
      const { flags } = parse([], {
        flags: {
          config: {
            type: objectType<{ PORT?: string; HOST?: string }>(),
            default: { PORT: "3000", HOST: "localhost" },
          },
        },
      });

      expect(flags).toEqual({
        config: {
          PORT: "3000",
          HOST: "localhost",
        },
      });
    });

    it("should merge user values with external default values", () => {
      const { flags } = parse(["--config.PORT", "8080"], {
        flags: {
          config: {
            type: objectType<{ PORT?: string; HOST?: string }>(),
            default: { PORT: "3000", HOST: "localhost" },
          },
        },
      });

      expect(flags).toEqual({
        config: {
          PORT: "8080",
          HOST: "localhost",
        },
      });
    });

    it("should work with custom setValue and external default values", () => {
      const { flags } = parse(["--config.PORT", "8080"], {
        flags: {
          config: {
            type: objectType<{ PORT?: number; HOST?: string }>({
              setValue: (object, path, value) => {
                if (path === "PORT") {
                  setDotValues(object, path, Number(value));
                } else {
                  setDotValues(object, path, coerceObjectValue(value));
                }
              },
            }),
            default: { PORT: 3000, HOST: "localhost" },
          },
        },
      });

      expect(flags).toEqual({
        config: {
          PORT: 8080,
          HOST: "localhost",
        },
      });
    });

    it("should override external default values with multiple user values", () => {
      const { flags } = parse(
        ["--config.PORT", "8080", "--config.HOST", "example.com"],
        {
          flags: {
            config: {
              type: objectType<{ PORT?: string; HOST?: string }>(),
              default: { PORT: "3000", HOST: "localhost" },
            },
          },
        },
      );

      expect(flags).toEqual({
        config: {
          PORT: "8080",
          HOST: "example.com",
        },
      });
    });

    it("should use custom mergeObject for external default", () => {
      const { flags } = parse(["--config.PORT", "8080"], {
        flags: {
          config: {
            type: objectType<{ PORT?: number; HOST?: string }>({
              mergeObject: (target, defaults) => {
                // Custom merge: keep user values, add missing defaults
                for (const [key, val] of Object.entries(defaults)) {
                  if (key === "PORT") {
                    target.PORT = 1145;
                  }
                  if (!(key in target)) {
                    (target as any)[key] = val;
                  }
                }
              },
            }),
            default: { PORT: 3000, HOST: "localhost" },
          },
        },
      });

      expect(flags).toEqual({
        config: {
          PORT: 1145,
          HOST: "localhost",
        },
      });
    });
  });
});
