import type { GoNode } from "@/ast";
import constants from "@/config/constants";
import { doc, type Doc, type ParserOptions, type Printer } from "prettier";
import astGuards from "@/ast";
import pkg from "prettier/doc.js";
import {
  printInline,
  printMultiBlock,
  printUnformattable,
  printPlainBlock,
} from "./utils/print";
import { hasPrettierIgnoreLine, isPrettierIgnoreBlock } from "@/ignore";
import {
  hasNodeLinebreak,
  isFollowedByEmptyLine,
} from "./utils/line-detection";

const { builders, utils } = pkg;

type ExtendedParserOptions = ParserOptions<GoNode>;

const printers = {
  [constants.PLUGIN_KEY]: <Printer<GoNode>>{
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
  },
};

export default printers;

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
