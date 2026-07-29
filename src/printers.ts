import type {
  GoInline,
  GoInlineEndDelimiter,
  GoInlineStartDelimiter,
  GoNode,
  GoTrimMarker,
  GoUnformattable,
} from "@/ast";
import astGuards from "@/ast";
import { isBlockEnd, isBlockStart, getFirstBlockParent } from "@/ast-navigation";
import { hasPrettierIgnoreLine, isPrettierIgnoreBlock } from "@/ignore";
import {
  doc,
  type AstPath,
  type Doc,
  type ParserOptions,
  type Printer,
} from "prettier";
import pkg from "prettier/doc.js";

const { builders, utils } = pkg;

type ExtendedParserOptions = ParserOptions<GoNode>;

/**
 * The plugin's Printer definition for the "go-template" astFormat. Consumed
 * (and keyed under the plugin's PLUGIN_KEY) by index.ts, which owns
 * assembling the final `printers` export required by the Prettier plugin API.
 */
const goTemplatePrinter: Printer<GoNode> = {
  print: (path, printOptions: ExtendedParserOptions, print) => {
    const node = path.getNode();

    switch (node?.type) {
      case "inline":
        return printInline(node, printOptions);
      case "double-block":
        return printMultiBlock(path, print);
      case "unformattable":
        return printUnformattable(node, printOptions);
    }

    throw new Error(
      `An error occured during printing. Found invalid node ${node?.type}.`,
    );
  },
  embed: (path, parserOptions) => {
    return embed(path, parserOptions);
  },
};

export default goTemplatePrinter;

const embed: Exclude<Printer<GoNode>["embed"], undefined> = () => {
  return async (textToDoc, print, path, optionsA) => {
    const node = path.getNode();

    const parserOptions = optionsA as ParserOptions;

    if (!node) {
      return undefined;
    }

    if (hasPrettierIgnoreLine(node)) {
      return parserOptions.originalText.substring(
        parserOptions.locStart(node),
        parserOptions.locEnd(node),
      );
    }

    if (node.type !== "block" && node.type !== "root") {
      return undefined;
    }

    // A prettier-ignore block's content must never be handed to the HTML
    // parser: it can be deliberately malformed HTML (e.g. a lone closing
    // tag), which the HTML parser is not guaranteed to accept. Short-circuit
    // here, before textToDoc is ever called, rather than after — otherwise
    // the (potentially failing) HTML parse still runs even though its
    // result would just be thrown away below.
    if (isPrettierIgnoreBlock(node)) {
      const startStatement = path.call(print, "start");
      const endStatement = node.end ? path.call(print, "end") : "";

      return [
        utils.removeLines(startStatement),
        printPlainBlock(node.content),
        endStatement,
      ];
    }

    const html = await textToDoc(node.aliasedContent, {
      ...parserOptions,
      parser: "html",
      parentParser: "go-template",
    });

    const mapped = utils.stripTrailingHardline(
      utils.mapDoc(html, (currentDoc) => {
        if (typeof currentDoc !== "string") {
          return currentDoc;
        }

        let mappedDoc: Doc = currentDoc;

        Object.keys(node.children).forEach(
          (key) =>
            (mappedDoc = doc.utils.mapDoc(mappedDoc, (docNode) =>
              typeof docNode !== "string" || !docNode.includes(key)
                ? docNode
                : [
                    docNode.substring(0, docNode.indexOf(key)),
                    path.call(print, "children", key),
                    docNode.substring(docNode.indexOf(key) + key.length),
                  ],
            )),
        );

        return mappedDoc;
      }),
    );

    if (astGuards.isRoot(node)) {
      return [mapped, builders.hardline];
    }

    const startStatement = path.call(print, "start");
    const endStatement = node.end ? path.call(print, "end") : "";

    const content = node.aliasedContent.trim()
      ? builders.indent([builders.softline, mapped])
      : "";

    const result = [startStatement, content, builders.softline, endStatement];

    const emptyLine =
      !!node.end && isFollowedByEmptyLine(node.end, parserOptions.originalText)
        ? builders.softline
        : "";

    if (astGuards.isMultiBlock(node.parent)) {
      return [result, emptyLine];
    }

    return builders.group([builders.group(result), emptyLine], {
      shouldBreak:
        !!node.end && hasNodeLinebreak(node.end, parserOptions.originalText),
    });
  };
};

export function printMultiBlock(
  path: AstPath,
  print: (path: AstPath) => Doc,
): Doc {
  return path.map(print, "blocks");
}

export function printInline(
  node: GoInline,
  parserOptions: ParserOptions,
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
  targetOpts: ParserOptions,
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

export function hasNodeLinebreak(node: GoInline, source: string): boolean {
  const start = node.index + node.length;
  const end = source.indexOf("\n", start);
  const suffix = source.substring(start, end);

  return !suffix;
}

export function isFollowedByEmptyLine(node: GoInline, source: string): boolean {
  const start = node.index + node.length;
  const firstLineBreak = source.indexOf("\n", start);
  const secondLineBreak = source.indexOf("\n", firstLineBreak + 1);
  const emptyLine = source
    .substring(firstLineBreak + 1, secondLineBreak)
    .trim();
  const isLastNode = !!source.substring(start).match(/^\s*$/);

  return (
    firstLineBreak !== -1 && secondLineBreak !== -1 && !emptyLine && !isLastNode
  );
}

export function isFollowedByNode(node: GoInline): boolean {
  const parent = getFirstBlockParent(node).parent;
  const start = parent.aliasedContent.indexOf(node.id) + node.id.length;

  let nextNodeIndex = -1;
  Object.keys(parent.children).forEach((key) => {
    const index = parent.aliasedContent.indexOf(key, start);
    if (nextNodeIndex === -1 || index < nextNodeIndex) {
      nextNodeIndex = index;
    }
  });

  return !!parent.aliasedContent
    .substring(start, nextNodeIndex)
    .match(/^\s+$/m);
}
