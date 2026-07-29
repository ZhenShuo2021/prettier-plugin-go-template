import type { GoNode } from "@/ast";
import astGuards from "@/ast";
import {
  getFirstBlockParent,
  getPreviousSibling,
} from "@/ast-navigation";

/**
 * True when `node` is itself a `{{/* prettier-ignore *\/}}` (or with trim
 * markers, `{{- /* prettier-ignore *\/ -}}`) comment node.
 */
function isPrettierIgnoreComment(node: GoNode): boolean {
  return (
    node.type === "inline" &&
    node.isComment &&
    node.statement.trim() === "prettier-ignore"
  );
}

export function hasPrettierIgnoreLine(node: GoNode): boolean {
  if (astGuards.isRoot(node)) {
    return false;
  }

  // A {{/* prettier-ignore */}} comment is parsed as its own standalone
  // node, so by the time we get here its text has already been aliased
  // away into an id — the regex below can no longer see it. Check the AST
  // directly: is the immediately preceding sibling a prettier-ignore
  // comment node?
  const previousSibling = getPreviousSibling(node);
  if (previousSibling && isPrettierIgnoreComment(previousSibling)) {
    return true;
  }

  const { parent, child } = getFirstBlockParent(node);

  const regex = new RegExp(
    `(?:<!--|{{-?).*?prettier-ignore.*?(?:-->|-?}})\n.*${child.id}`,
  );

  return !!parent.aliasedContent.match(regex);
}

export function isPrettierIgnoreBlock(node: GoNode): boolean {
  return astGuards.isBlock(node) && node.keyword === "prettier-ignore-start";
}
