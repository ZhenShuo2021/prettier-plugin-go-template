import type {
  GoInline,
  GoInlineEndDelimiter,
  GoInlineStartDelimiter,
  GoTrimMarker,
  GoUnformattable,
} from "@/ast";
import { type AstPath, type Doc, type ParserOptions } from "prettier";
import pkg from "prettier/doc.js";
import { isBlockEnd, isBlockStart } from "./ast-navigation";
import {
  hasNodeLinebreak,
  isFollowedByEmptyLine,
  isFollowedByNode,
} from "./line-detection";

const { builders } = pkg;

type ExtendedParserOptions = ParserOptions;

export function printMultiBlock(
  path: AstPath,
  print: (path: AstPath) => Doc,
): Doc {
  return path.map(print, "blocks");
}

export function printInline(
  node: GoInline,
  parserOptions: ExtendedParserOptions,
): Doc {
  const isBlockNode = isBlockEnd(node) || isBlockStart(node);
  const emptyLine =
    isFollowedByEmptyLine(node, parserOptions.originalText) &&
    isFollowedByNode(node)
      ? builders.softline
      : "";

  const result: Doc[] = [
    printStatement(
      node.statement,
      {
        trimStart: node.trimStart,
        start: node.startDelimiter,
        end: node.endDelimiter,
        trimEnd: node.trimEnd,
      },
      node.isComment,
      node.commentLeadingWs,
      node.commentTrailingWs,
    ),
  ];

  return builders.group([...result, emptyLine], {
    shouldBreak:
      hasNodeLinebreak(node, parserOptions.originalText) && !isBlockNode,
  });
}

export function printStatement(
  statement: string,
  delimiter: {
    trimStart?: GoTrimMarker;
    start: GoInlineStartDelimiter;
    end: GoInlineEndDelimiter;
    trimEnd?: GoTrimMarker;
  } = {
    trimStart: "",
    start: "",
    end: "",
    trimEnd: "",
  },
  isComment = false,
  commentLeadingWs = "",
  commentTrailingWs = "",
) {
  const space = " ";
  const shouldBreak = statement.includes("\n");

  // Go template trim markers ("-") require whitespace after them to be
  // recognized as trim markers at all; without it, "{{-/* ... */-}}"
  // is not valid trim syntax. This is a hard syntactic requirement, not
  // a style choice.
  const trimStartGap =
    delimiter.trimStart && delimiter.start === "/*" ? " " : "";
  const trimEndGap = delimiter.end === "*/" && delimiter.trimEnd ? " " : "";

  // Comments must never have their inner text reformatted: no per-line
  // trim, no re-indentation, no reflow. Reproduce the original text
  // (including the whitespace immediately inside the delimiters)
  // verbatim, using literalline so embedded newlines bypass the doc
  // printer's indentation logic entirely.
  const toLiteralDoc = (raw: string): Doc[] =>
    raw
      .split("\n")
      .flatMap((line, index, array) =>
        index === array.length - 1 ? [line] : [line, builders.literalline],
      );

  const content = isComment
    ? [
        ...toLiteralDoc(commentLeadingWs),
        ...toLiteralDoc(statement),
        ...toLiteralDoc(commentTrailingWs),
      ]
    : shouldBreak
      ? statement
          .trim()
          .split("\n")
          .map((line, index, array) =>
            index === array.length - 1
              ? [line.trim(), builders.softline]
              : builders.indent([line.trim(), builders.softline]),
          )
      : [statement.trim()];

  // For comments, commentLeadingWs/commentTrailingWs already reproduce the
  // exact original spacing next to the delimiters, so no extra
  // padding should be injected there.
  const leadingSpace = isComment ? "" : space;
  const trailingSpace = isComment ? "" : shouldBreak ? "" : space;

  return builders.group(
    [
      "{{",
      delimiter.trimStart ?? "",
      trimStartGap,
      delimiter.start,
      leadingSpace,
      ...content,
      trailingSpace,
      delimiter.end,
      trimEndGap,
      delimiter.trimEnd ?? "",
      "}}",
    ],
    { shouldBreak },
  );
}

export function printUnformattable(
  node: GoUnformattable,
  targetOpts: ExtendedParserOptions,
) {
  const start = targetOpts.originalText.lastIndexOf("\n", node.index - 1);
  const line = targetOpts.originalText.substring(
    start,
    node.index + node.length,
  );
  const lineWithoutAdditionalContent =
    line.replace(node.content, "").match(/\s*$/)?.[0] ?? "";

  return printPlainBlock(lineWithoutAdditionalContent + node.content, false);
}

export function printPlainBlock(text: string, hardlines = true): Doc {
  const isTextEmpty = (input: string) => !!input.match(/^\s*$/);

  const lines = text.split("\n");

  const segments = lines.filter(
    (value, i) => !(i === 0 || i === lines.length - 1) || !isTextEmpty(value),
  );

  return [
    ...segments.map((content, i) => [
      hardlines || i ? builders.hardline : "",
      builders.trim,
      content,
    ]),
    hardlines ? builders.hardline : "",
  ];
}
