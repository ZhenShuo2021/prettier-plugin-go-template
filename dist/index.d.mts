import { Parser, Printer } from "prettier";

//#region src/ast.d.ts
type GoTrimMarker = "-" | "";
type GoSharedDelimiter = "%" | "";
type GoInlineStartDelimiter = "<" | "/*" | GoSharedDelimiter;
type GoInlineEndDelimiter = ">" | "*/" | GoSharedDelimiter;
type GoBlockKeyword = "if" | "range" | "block" | "with" | "define" | "else" | "prettier-ignore-start" | "prettier-ignore-end" | "end";
interface GoBaseNode<Type extends string> {
  id: string;
  type: Type;
  index: number;
  length: number;
  parent: GoBlock | GoRoot | GoMultiBlock;
}
/**
 * Carries explicit start/end delimiter variants used by Go template statements.
 */
interface WithDelimiter {
  trimStart: GoTrimMarker;
  startDelimiter: GoInlineStartDelimiter;
  endDelimiter: GoInlineEndDelimiter;
  trimEnd: GoTrimMarker;
}
interface GoInline extends GoBaseNode<"inline">, WithDelimiter {
  statement: string;
  /** True when this node is a Go template comment ({{/* ... *\/}}), whose
   * inner text must be preserved as-is and never reformatted. */
  isComment: boolean;
  /** Raw whitespace between "/*" and the comment text. Only meaningful
   * when isComment is true; used to reproduce comments verbatim. */
  commentLeadingWs?: string;
  /** Raw whitespace between the comment text and "*\/". Only meaningful
   * when isComment is true; used to reproduce comments verbatim. */
  commentTrailingWs?: string;
}
/**
 * Represents raw regions that must be preserved as-is and skipped by formatting.
 */
interface GoUnformattable extends GoBaseNode<"unformattable"> {
  content: string;
}
interface GoBlock extends GoBaseNode<"block">, WithDelimiter {
  keyword: GoBlockKeyword;
  /** Child nodes keyed by generated node id for stable alias replacement. */
  children: {
    [id: string]: GoNode;
  };
  start: GoInline;
  end: GoInline | null;
  content: string;
  /**
   * Content with child nodes replaced by ids so HTML formatting can run first,
   * then children can be re-injected from the map.
   */
  aliasedContent: string;
  contentStart: number;
}
/**
 * Groups related branch blocks (for example, if/else chains) as a single node.
 */
interface GoMultiBlock extends GoBaseNode<"double-block"> {
  blocks: (GoBlock | GoMultiBlock)[];
  keyword: GoBlockKeyword;
}
type GoRoot = {
  type: "root";
} & Omit<GoBlock, "type" | "keyword" | "parent" | "statement" | "id" | "trimStart" | "startDelimiter" | "endDelimiter" | "trimEnd" | "start" | "end">;
type GoNode = GoRoot | GoBlock | GoInline | GoMultiBlock | GoUnformattable;
//#endregion
//#region src/index.d.ts
declare const languages: import("prettier").SupportLanguage[];
declare const parsers: {
  [key: string]: Parser<GoNode>;
};
declare const printers: {
  [key: string]: Printer<GoNode>;
};
//#endregion
export { languages, parsers, printers };