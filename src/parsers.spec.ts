import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGoTemplate, isValidStatement } from "./parsers";
import type { GoNode } from "./ast";
import type { ParserOptions } from "prettier";

const parserOptions = {} as ParserOptions<GoNode>;

const createMockMatch = (
  index: number | undefined,
  overrides?: {
    statement?: string;
    keyword?: string;
    startdelimiter?: string;
    endDelimiter?: string;
  },
) => ({
  0: "{{ if true }}",
  length: 1,
  index,
  groups: {
    statement: "if true",
    keyword: "if",
    startdelimiter: "",
    endDelimiter: "",
    ...overrides,
  },
});

describe("parseGoTemplate error guards", () => {
  // Some guards below are integrity checks for impossible-or-rare states under
  // normal parsing flow. Keep mock-based tests to prevent accidental removal
  // of these defensive throws during refactors.
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('throws "Regex match index undefined." for a malformed match object', async () => {
    vi.spyOn(String.prototype, "matchAll").mockReturnValue([
      createMockMatch(undefined),
    ] as any);

    expect(() => parseGoTemplate("{{ if true }}", parserOptions)).toThrow(
      new Error("Regex match index undefined."),
    );
  });

  // Uses a mock because normal input should not empty the stack mid-loop.
  // Real-world cause (rare): internal state corruption by future refactors.
  it('throws "Node stack empty." when parsing text with an empty stack state', async () => {
    vi.doMock("./utils", () => ({
      createIdGenerator: () => () => "mock-id",
      default: () => undefined,
    }));

    vi.spyOn(String.prototype, "matchAll").mockReturnValue([
      createMockMatch(0),
    ] as any);

    const { parseGoTemplate } = await import("./parsers");

    expect(() => parseGoTemplate("{{ if true }}", parserOptions)).toThrow(
      new Error("Node stack empty."),
    );
  });

  // Uses a mock because regex-defined groups should include `statement` for
  // formattable matches. Real-world cause (rare): regex/group changes causing
  // contract mismatch between parser logic and capture groups.
  it('throws "Formattable match without statement." for a statement-less match', () => {
    vi.spyOn(String.prototype, "matchAll").mockReturnValue([
      createMockMatch(0, { statement: undefined }),
    ] as any);

    expect(() => parseGoTemplate("{{ }}", parserOptions)).toThrow(
      new Error("Formattable match without statement."),
    );
  });

  // Example: {{ end }} appears without a matching opening block like {{ if }}.
  it('throws "Encountered unexpected end keyword." for orphan {{ end }} at root', () => {
    expect(() => parseGoTemplate("{{ end }}", parserOptions)).toThrow(
      new Error("Encountered unexpected end keyword."),
    );
  });

  // Example: {{ define "title }} has an unclosed string literal.
  it("throws for unclosed string literals in template statements", () => {
    expect(() => parseGoTemplate('{{ define "title }}', parserOptions)).toThrow(
      new Error("String literal is not closed. Invalid Go template statement"),
    );
  });

  // Comment actions are opaque payloads and may include unmatched quotes.
  it("does not throw for unmatched quotes inside comment actions", () => {
    expect(() => parseGoTemplate('{{/* " */}}', parserOptions)).not.toThrow();
  });

  // Uses a mock because normal AST assembly should always provide a parent
  // shape with `children` in this branch. Real-world cause (rare): malformed
  // parent linkage introduced by block/else handling refactors.
  it('throws "Could not find child in parent." for malformed {{ else }} parent linkage', async () => {
    vi.doMock("./utils", () => ({
      createIdGenerator: () => () => "mock-id",
      default: () => ({
        type: "block",
        id: "block-id",
        index: 0,
        parent: {},
      }),
    }));

    vi.spyOn(String.prototype, "matchAll").mockReturnValue([
      createMockMatch(0, {
        statement: "else",
        keyword: "else",
      }),
    ] as any);

    const { parseGoTemplate } = await import("./parsers");

    expect(() => parseGoTemplate("{{ else }}", parserOptions)).toThrow(
      new Error("Could not find child in parent."),
    );
  });

  // Example: {{ if }}\n<span>Invalid</span> without a closing {{ end }}.
  it('throws "Missing end block." for unclosed {{ if }} blocks', () => {
    expect(() =>
      parseGoTemplate("{{ if }}\n<span>Invalid</span>", parserOptions),
    ).toThrow(new Error("Missing end block."));
  });
});

describe("isValidStatement", () => {
  type TestCase = {
    name: string;
    statement: string;
    expected: boolean;
  };

  const CASES: TestCase[] = [
    {
      name: "returns true for statement without quotes",
      statement: "{{if true}}content{{end}}",
      expected: true,
    },
    {
      name: "returns true for closed double-quoted string",
      statement: `define "Norwegian krone"`,
      expected: true,
    },
    {
      name: "returns false for unclosed double-quoted string",
      statement: `define "Norwegian krone`,
      expected: false,
    },
    {
      name: "returns true when escaped quote appears inside double quotes",
      statement: String.raw`define "a\"b"`,
      expected: true,
    },
    {
      name: "returns true for closed raw string with double quote inside",
      statement: String.raw`define \`a"b\``,
      expected: true,
    },
    {
      name: "returns false for unclosed raw string",
      statement: String.raw`define \`a"b`,
      expected: false,
    },
    {
      name: "returns true for multiline closed double-quoted string",
      statement: `define "line1
line2"`,
      expected: true,
    },
    {
      name: "returns false for multiline unclosed double-quoted string",
      statement: `define "line1
line2`,
      expected: false,
    },
  ];

  it.each(CASES)("$name", ({ statement, expected }) => {
    const result = isValidStatement(statement);
    expect(result).toBe(expected);
  });
});
