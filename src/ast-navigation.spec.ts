import type { GoInline, GoBlock, GoRoot } from "./ast";
import {
  getFirstBlockParent,
  isBlockEnd,
  isBlockStart,
} from "./ast-navigation";

describe("getFirstBlockParent", () => {
  it("should return the parent node if it is a block", () => {
    const mockInline: GoInline = {
      id: "inline-1",
      type: "inline",
      isComment: false,
      index: 0,
      length: 10,
      statement: "test",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoBlock,
    };

    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 30,
      keyword: "if",
      children: { "inline-1": mockInline },
      start: mockInline,
      end: null,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      aliasedContent: "inline-1",
      content: "inline-1",
      contentStart: 0,
    };

    mockInline.parent = mockBlock;

    const result = getFirstBlockParent(mockInline);
    expect(result.parent).toBe(mockBlock);
    expect(result.child).toBe(mockInline);
  });

  it("should skip intermediate non-block parents to find the first block parent", () => {
    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 50,
      keyword: "if",
      children: {},
      start: {} as GoInline,
      end: null,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      content: "",
      aliasedContent: "",
      contentStart: 0,
    };

    const mockInline: GoInline = {
      id: "inline-1",
      type: "inline",
      isComment: false,
      index: 10,
      length: 10,
      statement: "test",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: mockBlock,
    };

    const result = getFirstBlockParent(mockInline);
    expect(result.parent).toBe(mockBlock);
    expect(result.child).toBe(mockInline);
  });
});

describe("isBlockEnd", () => {
  it("should return true if the node is a block end node", () => {
    const mockInline: GoInline = {
      id: "end-1",
      type: "inline",
      isComment: false,
      index: 40,
      length: 10,
      statement: "end",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoBlock,
    };

    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 50,
      keyword: "if",
      children: { "end-1": mockInline },
      start: {} as GoInline,
      end: mockInline,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      content: "",
      aliasedContent: "",
      contentStart: 0,
    };

    mockInline.parent = mockBlock;

    expect(isBlockEnd(mockInline)).toBe(true);
  });

  it("should return false if the node is not a block end node", () => {
    const mockInline: GoInline = {
      id: "inline-1",
      type: "inline",
      isComment: false,
      index: 10,
      length: 10,
      statement: "test",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoBlock,
    };

    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 50,
      keyword: "if",
      children: { "inline-1": mockInline },
      start: {} as GoInline,
      end: {} as GoInline,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      content: "",
      aliasedContent: "",
      contentStart: 0,
    };

    mockInline.parent = mockBlock;

    expect(isBlockEnd(mockInline)).toBe(false);
  });
});

describe("isBlockStart", () => {
  it("should return true if the node is a block start node", () => {
    const mockStartInline: GoInline = {
      id: "start-1",
      type: "inline",
      isComment: false,
      index: 0,
      length: 10,
      statement: "if",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoBlock,
    };

    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 50,
      keyword: "if",
      children: { "start-1": mockStartInline },
      start: mockStartInline,
      end: {} as GoInline,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      content: "",
      aliasedContent: "",
      contentStart: 0,
    };

    mockStartInline.parent = mockBlock;

    expect(isBlockStart(mockStartInline)).toBe(true);
  });

  it("should return false if the node is not a block start node", () => {
    const mockInline: GoInline = {
      id: "inline-1",
      type: "inline",
      isComment: false,
      index: 10,
      length: 10,
      statement: "test",
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoBlock,
    };

    const mockBlock: GoBlock = {
      id: "block-1",
      type: "block",
      index: 0,
      length: 50,
      keyword: "if",
      children: { "inline-1": mockInline },
      start: {} as GoInline,
      end: {} as GoInline,
      trimStart: "",
      startDelimiter: "",
      endDelimiter: "",
      trimEnd: "",
      parent: {} as GoRoot,
      content: "",
      aliasedContent: "",
      contentStart: 0,
    };

    mockInline.parent = mockBlock;

    expect(isBlockStart(mockInline)).toBe(false);
  });
});
