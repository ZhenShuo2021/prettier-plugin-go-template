import { printStatement, printPlainBlock } from "./print";

describe("printStatement", () => {
  it("should return a Doc object", () => {
    const result = printStatement("variable");

    expect(result).toBeDefined();
    expect(typeof result).not.toBe("string");
  });

  it("should accept custom delimiters", () => {
    const result = printStatement("variable", {
      trimStart: "-",
      start: "/*",
      end: "*/",
      trimEnd: "-",
    });

    expect(result).toBeDefined();
  });

  it("should handle multiline statements", () => {
    const multilineStatement = "if test\n  result\nend";
    const result = printStatement(multilineStatement);

    expect(result).toBeDefined();
  });

  it("should handle empty statements", () => {
    const result = printStatement("");

    expect(result).toBeDefined();
  });
});

describe("printPlainBlock", () => {
  it("should return a Doc object", () => {
    const text = "line 1\nline 2";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should handle single line text", () => {
    const text = "single line";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should handle multiline text", () => {
    const text = "line 1\nline 2\nline 3";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should handle empty text", () => {
    const text = "";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should handle text with leading and trailing whitespace", () => {
    const text = "  \nline 1\nline 2\n  ";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should process with hardlines parameter set to true", () => {
    const text = "line 1\nline 2";
    const result = printPlainBlock(text, true);

    expect(result).toBeDefined();
  });

  it("should process with hardlines parameter set to false", () => {
    const text = "line 1\nline 2";
    const result = printPlainBlock(text, false);

    expect(result).toBeDefined();
  });
});
