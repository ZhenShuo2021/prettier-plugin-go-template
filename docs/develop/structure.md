## Project Structure

Modular core under [`src/`](../../src/):

| Path                                                   | Role                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`src/index.ts`](../../src/index.ts)                   | Plugin entrypoint; exports `languages`, `options`, `parsers`, and `printers`       |
| [`src/config/`](../../src/config/)                     | Plugin constants, language registration, and user option definitions               |
| [`src/features/parser/`](../../src/features/parser/)   | Parser orchestration (`parsers.ts`) and regex AST builder (`parse-go-template.ts`) |
| [`src/features/printer/`](../../src/features/printer/) | Printer orchestration (`printers.ts`) and printer helper utilities                 |
| [`src/types/`](../../src/types/)                       | AST and option types (`src/types/ast/ast.ts`, guards, parser-option interfaces)    |
| [`src/utils/`](../../src/utils/)                       | Shared utility helpers such as ULID ID generation and collection helpers           |

## Formatting Flow

Parser in [`src/features/parser/parse-go-template.ts`](../../src/features/parser/parse-go-template.ts) builds aliased AST.
Printer `embed()` in [`src/features/printer/printers.ts`](../../src/features/printer/printers.ts) maps IDs back to formatted children through Prettier HTML.
The final document output is emitted from that formatted tree.
