import type {
  GoNode,
  GoRoot,
  GoBlock,
  GoBlockKeyword,
  GoInlineStartDelimiter,
  GoInlineEndDelimiter,
  GoTrimMarker,
  GoInline,
  GoMultiBlock,
} from "@/types/ast/ast";
import astGuards from "@/types/ast/ast-guards";
import { createIdGenerator } from "@/utils/create-id-generator";
import last from "@/utils/last";
import type { Parser } from "prettier";
import { aliasNodeContent } from "@/features/parser/alias-node-content";
import { isValidStatement } from "@/features/parser/is-valid-statement";

export const parseGoTemplate: Parser<GoNode>["parse"] = (text) => {
  // Delimiter and keyword pieces
  // Trim markers ("-") are captured separately from the action/comment
  // delimiter so both can appear together, e.g. {{- /* comment */ -}}.
  const TRIM_START = String.raw`(?<trimStart>-)?`;
  const TRIM_END = String.raw`(?<trimEnd>-)?`;
  const START_DELIMITER = String.raw`(?<startdelimiter><|%|\/\*)?`;
  const END_DELIMITER = String.raw`(?<endDelimiter>>|%|\*\/)?`;
  const KEYWORD = String.raw`(?<keyword>if|range|block|with|define|end|else|prettier-ignore-start|prettier-ignore-end)?`;

  // Inline/formattable template
  // leadingWs/trailingWs capture the whitespace immediately inside the
  // delimiters (e.g. right after "/*" and right before "*/"). They are
  // ignored for ordinary statements (which are trimmed when printed) but
  // are needed to reproduce comments verbatim without any reformatting.
  const INLINE_FORMATTABLE_TEMPLATE = String.raw`{{${TRIM_START}\s*${START_DELIMITER}(?<leadingWs>\s*)(?<statement>${KEYWORD}[\s\S]*?)(?<trailingWs>\s*)${END_DELIMITER}\s*${TRIM_END}}}`;

  const buildUnformattableTag = (
    tagName: "script" | "style",
    groupName: string,
  ) =>
    String.raw`(?<${groupName}><(${tagName})((?!<)[\s\S])*>((?!<\/${tagName})[\s\S])*?{{[\s\S]*?<\/(${tagName})>)`;
  // Unformattable script

  const UNFORMATTABLE_SCRIPT = buildUnformattableTag(
    "script",
    "unformattableScript",
  );

  // Unformattable style
  const UNFORMATTABLE_STYLE = buildUnformattableTag(
    "style",
    "unformattableStyle",
  );

  // Matches:
  // - standard Go template inline statements
  // - script/style regions that contain template markers and must stay raw
  const GO_TEMPLATE_REGEX = new RegExp(
    [
      INLINE_FORMATTABLE_TEMPLATE, // {{ ... }}
      UNFORMATTABLE_SCRIPT, // <script>...{{...}}...</script>
      UNFORMATTABLE_STYLE, // <style>...{{...}}...</style>
    ].join("|"),
    "g",
  );

  const root: GoRoot = {
    type: "root",
    content: text,
    aliasedContent: "",
    children: {},
    index: 0,
    contentStart: 0,
    length: text.length,
  };
  const nodeStack: (GoBlock | GoRoot)[] = [root];
  const getId = createIdGenerator();

  for (const match of text.matchAll(GO_TEMPLATE_REGEX)) {
    if (match.index === undefined) {
      throw Error("Regex match index undefined.");
    }

    const current = last(nodeStack);
    if (current === undefined) {
      throw Error("Node stack empty.");
    }

    const unformattable =
      match.groups?.unformattableScript ?? match.groups?.unformattableStyle;

    const id = getId();
    if (unformattable) {
      current.children[id] = {
        id,
        type: "unformattable",
        index: match.index,
        length: match[0].length,
        content: unformattable,
        parent: current,
      };
      continue;
    }

    const statement = match.groups?.statement;
    if (statement === undefined) {
      throw Error("Formattable match without statement.");
    }

    const trimStart = (match.groups?.trimStart ?? "") as GoTrimMarker;
    const trimEnd = (match.groups?.trimEnd ?? "") as GoTrimMarker;
    const startDelimiter = (match.groups?.startdelimiter ??
      "") as GoInlineStartDelimiter;
    const endDelimiter = (match.groups?.endDelimiter ??
      "") as GoInlineEndDelimiter;
    const isCommentAction = startDelimiter === "/*" && endDelimiter === "*/";
    const leadingWs = isCommentAction ? (match.groups?.leadingWs ?? "") : "";
    const trailingWs = isCommentAction
      ? (match.groups?.trailingWs ?? "")
      : "";

    if (!isCommentAction && !isValidStatement(statement)) {
      throw Error(
        "String literal is not closed. Invalid Go template statement",
      );
    }

    const inline: GoInline = {
      index: match.index,
      length: match[0].length,
      trimStart,
      startDelimiter,
      endDelimiter,
      trimEnd,
      parent: current!,
      type: "inline",
      statement,
      isComment: isCommentAction,
      commentLeadingWs: leadingWs,
      commentTrailingWs: trailingWs,
      id,
    };

    const keyword = match.groups?.keyword as GoBlockKeyword | undefined;

    if (keyword === "end" || keyword === "prettier-ignore-end") {
      if (current.type !== "block") {
        throw Error("Encountered unexpected end keyword.");
      }

      current.length = match[0].length + match.index - current.index;
      current.content = text.substring(current.contentStart, match.index);
      current.aliasedContent = aliasNodeContent(current);
      current.end = inline;

      if (current.parent.type === "double-block") {
        const firstChild = current.parent.blocks[0];
        const lastChild =
          current.parent.blocks[current.parent.blocks.length - 1];

        current.parent.length =
          lastChild.index + lastChild.length - firstChild.index;
      }

      nodeStack.pop();
    } else if (astGuards.isBlock(current) && keyword === "else") {
      const nextChild: GoBlock = {
        type: "block",
        start: inline,
        end: null,
        children: {},
        keyword,
        index: match.index,
        parent: current.parent,
        contentStart: match.index + match[0].length,
        content: "",
        aliasedContent: "",
        length: -1,
        id: getId(),
        trimStart,
        startDelimiter,
        endDelimiter,
        trimEnd,
      };

      if (astGuards.isMultiBlock(current.parent)) {
        current.parent.blocks.push(nextChild);
      } else {
        const multiBlock: GoMultiBlock = {
          type: "double-block",
          parent: current.parent,
          index: current.index,
          length: -1,
          keyword,
          id: current.id,
          blocks: [current, nextChild],
        };
        nextChild.parent = multiBlock;
        current.parent = multiBlock;

        if ("children" in multiBlock.parent) {
          multiBlock.parent.children[multiBlock.id] = multiBlock;
        } else {
          throw Error("Could not find child in parent.");
        }
      }

      current.id = getId();
      current.length = match[0].length + match.index - current.index;
      current.content = text.substring(current.contentStart, match.index);
      current.aliasedContent = aliasNodeContent(current);

      nodeStack.pop();
      nodeStack.push(nextChild);
    } else if (keyword) {
      const block: GoBlock = {
        type: "block",
        start: inline,
        end: null,
        children: {},
        keyword: keyword as GoBlockKeyword,
        index: match.index,
        parent: current,
        contentStart: match.index + match[0].length,
        content: "",
        aliasedContent: "",
        length: -1,
        id: getId(),
        trimStart,
        startDelimiter,
        endDelimiter,
        trimEnd,
      };

      current.children[block.id] = block;
      nodeStack.push(block);
    } else {
      current.children[inline.id] = inline;
    }
  }

  if (!astGuards.isRoot(nodeStack.pop()!)) {
    throw Error("Missing end block.");
  }

  root.aliasedContent = aliasNodeContent(root);

  return root;
};
