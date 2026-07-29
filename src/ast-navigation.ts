import type { GoBlock, GoInline, GoNode, GoRoot } from "@/ast";
import astGuards from "@/ast";

export function getFirstBlockParent(node: Exclude<GoNode, GoRoot>): {
  parent: GoBlock | GoRoot;
  child: typeof node;
} {
  let previous = node;
  let current = node.parent;

  while (!astGuards.isBlock(current) && !astGuards.isRoot(current)) {
    previous = current;
    current = current.parent;
  }

  return {
    child: previous,
    parent: current,
  };
}

export function isBlockEnd(node: GoInline): boolean {
  const { parent } = getFirstBlockParent(node);
  return astGuards.isBlock(parent) && parent.end === node;
}

export function isBlockStart(node: GoInline): boolean {
  const { parent } = getFirstBlockParent(node);
  return astGuards.isBlock(parent) && parent.start === node;
}

/**
 * Returns the sibling that immediately precedes `node` among its parent's
 * direct children (ordered by source position), or undefined if `node` is
 * the first child. Used to look up a preceding standalone node — such as a
 * `{{/* prettier-ignore *\/}}` comment — without relying on string matching.
 */
export function getPreviousSibling(node: GoNode): GoNode | undefined {
  if (astGuards.isRoot(node)) {
    return undefined;
  }

  const { parent, child } = getFirstBlockParent(node);
  const siblings = Object.values(parent.children).sort(
    (a, b) => a.index - b.index,
  );

  const position = siblings.indexOf(child);
  return position > 0 ? siblings[position - 1] : undefined;
}
