# Architecture

This document describes how the plugin turns mixed Go-template + HTML source
into formatted output. It is conceptual, not exhaustive — the goal is to let
someone predict how a change or a bug fits into the system without reading
the whole codebase. For exact behavior, read the referenced source files.

## Core idea

Prettier's HTML parser only understands HTML. It has no notion of `{{ }}`.
This plugin does not implement its own combined HTML+Go-template formatter.
Instead, for every region that needs HTML formatting, it:

1. Temporarily replaces each Go-template construct with a short opaque
   placeholder (an id), leaving the surrounding HTML untouched.
2. Hands that placeholder-riddled text to Prettier's real HTML parser.
3. Takes the HTML parser's output and splices each placeholder back out for
   the real, freshly-printed Go-template content.

Everything else in the plugin exists to make this substitute-format-restore
cycle correct. When reasoning about any behavior, ask: which of the three
steps is it happening in, and does it depend on something the HTML parser
can or cannot see at that point?

## Node model

Source text is parsed into a tree of nodes (`src/types/ast/ast.ts`):

- **root** — the whole file.
- **block** — a Go-template construct with a matching start/end pair and
  content in between (`{{if}}...{{end}}`, `{{range}}...{{end}}`, etc.).
- **multi-block** — a chain of related blocks (e.g. an if/else chain),
  grouped so they print as one unit.
- **inline** — a single self-contained action or comment
  (`{{ .Value }}`, `{{/* comment */}}`).
- **unformattable** — a raw region that must be reproduced byte-for-byte
  (e.g. `<script>`/`<style>` bodies that themselves contain `{{ }}`).

Each node knows its position in the original text and holds a reference to
its parent, so any part of the tree can walk up to find an enclosing block
or look at its siblings.

## The parse → alias → embed → restore pipeline

```text
source text
    │  parse: scan for {{ }} actions and unformattable regions,
    │  build the node tree above
    │  (src/features/parser/parse-go-template.ts)
    ▼
node tree, each root/block node holding two versions of its own content:
    │  - content:          the original text, verbatim
    │  - aliasedContent:    the same text, but with each *direct child's*
    │                       span replaced by that child's id
    │  (src/features/parser/alias-node-content.ts)
    ▼
    │  embed: hand aliasedContent to Prettier's built-in HTML parser
    │  (src/features/printer/printers.ts)
    ▼
an HTML-formatted Doc tree, in which the ids appear as ordinary opaque text
(the HTML parser doesn't know they're special — it just sees strings)
    │  restore: walk the Doc, find each child id, and replace it with that
    │  child's own printed output (which recurses through this same
    │  pipeline for block children, or prints directly for inline children)
    │  (src/features/printer/printers.ts, via mapDoc)
    ▼
final Doc → output text
```

The important consequence: **only what's literally present in
`aliasedContent` at the moment it's handed to the HTML parser can influence
how the HTML parser formats things.** Anything encoded elsewhere — a flag on
a node, a piece of the original source text that was already aliased away,
metadata computed separately — is invisible to that step. If some feature is
supposed to change HTML-parser behavior (spacing, whitespace sensitivity,
what gets left alone, etc.), it must be expressed as literal text inside
`aliasedContent`/the text passed to `textToDoc`, not as a side-channel the
HTML parser has no way to consult.

Conversely, anything the HTML parser doesn't need to know about — how a
Go-template node itself should be printed, its own internal formatting — can
live purely in the node's own attributes and be handled by that node's own
print logic, independent of the HTML parser entirely.

## Two kinds of "don't format this"

Some nodes should print exactly as written, without being handed to the
HTML parser at all. `embed()` short-circuits before calling into the HTML
parser whenever a node matches such a rule (see `src/ignore.ts` for the
concrete conditions). There are two flavors of reason to do this:

- **The content is intentionally not valid/complete HTML on its own** (e.g.
  a deliberately unbalanced tag), so even attempting to parse it with the
  HTML parser could fail or produce nonsense.
- **The user explicitly asked this node to be left alone**, regardless of
  whether the HTML parser could technically handle it.

Both cases bypass the HTML parser at the node level. Neither of them is the
same thing as "make the HTML parser itself skip formatting a sibling node"
(the HTML parser has its own native mechanism for that, using its own
comment syntax) — that's a separate concept, and reproducing it for a
non-HTML spelling of the same instruction means encoding it into
`aliasedContent` as the previous section describes, not adding a new
short-circuit.

## Position- and whitespace-sensitive information

Some formatting decisions depend on facts about the original source that
aren't naturally preserved by either the aliasing step or the HTML parser on
their own — for example, how many blank lines separated two constructs, or
whether trim markers were used. These are generally handled one of two ways:

- **Left inside `aliasedContent` as literal text** (e.g. blank lines that
  fall inside a single node's own content are just part of the string handed
  to the HTML parser, which applies its own rules to them).
- **Computed separately from the source text and re-applied after the fact**
  (e.g. a helper inspects the raw source around a node's boundaries and the
  printer adds explicit line breaks based on that, independent of whatever
  the HTML parser did).

Because both mechanisms can apply to the same gap in the source from
different angles, it's possible for them to duplicate or contradict each
other — one preserving something, the other separately trying to preserve
the same thing. When output has an unexpected amount of whitespace/blank
lines around a boundary between an aliased node and its surroundings, check
whether more than one of these mechanisms is acting on that same boundary.

## File map

| Concept | File |
|---|---|
| Source text → node tree | `src/features/parser/parse-go-template.ts` |
| Node content → aliasedContent (children replaced with ids) | `src/features/parser/alias-node-content.ts` |
| Node type definitions | `src/types/ast/ast.ts` |
| Node type guards (isBlock/isRoot/isMultiBlock/...) | `src/types/ast/ast-guards.ts` |
| embed: calling the HTML parser, restoring children, ignore short-circuits | `src/features/printer/printers.ts` |
| Printing of standalone inline nodes | `src/features/printer/utils/print.ts` |
| Source-position/whitespace inspection helpers | `src/features/printer/utils/line-detection.ts` |
| AST traversal helpers (parent block, siblings) | `src/features/printer/utils/ast-navigation.ts` |
| `prettier-ignore` family of rules | `src/ignore.ts` |
