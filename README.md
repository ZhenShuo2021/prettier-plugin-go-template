> ⚠️ **Do not use.** Personal fork for private use, entirely AI-written, not intended for external use.

# prettier-plugin-go-template

A Prettier plugin for formatting Go and Hugo template files with comprehensive support for template syntax and intelligent HTML formatting.

## For Developers

See [AGENTS.md](AGENTS.md) for architecture, commands, and project structure.

See [docs/develop](docs/develop) for development documentation.

## Changes from the original

1. Managed with pnpm
2. Support for `prettier-ignore` with trim markers: `{{- /* prettier-ignore-start */ -}}`
3. Support for single-node `prettier-ignore`: `{{/* prettier-ignore */}}` [#95](https://github.com/NiklasPor/prettier-plugin-go-template/issues/95)
4. Comment text is no longer reformatted
5. Keywords inside comments are no longer misinterpreted [#93](https://github.com/NiklasPor/prettier-plugin-go-template/issues/93)
6. `prettier-ignore` blocks are no longer passed to the HTML parser
7. Removed the `goTemplateBracketSpacing` option; its behavior is now the default

won't fix:

1. [#82](https://github.com/NiklasPor/prettier-plugin-go-template/issues/82) The missing-report issue no longer occurs
2. [#94](https://github.com/NiklasPor/prettier-plugin-go-template/issues/94) Use the HTML-style ignore instead `<!-- prettier-ignore-start -->`. This project doesn't touch the HTML parser, so it naturally can't change how the HTML parser builds its AST
3. [#102](https://github.com/NiklasPor/prettier-plugin-go-template/issues/102) This would require writing an attribute parser during the Go template scan, hard to get fully right, so not doing it
4. [#109](https://github.com/NiklasPor/prettier-plugin-go-template/issues/109) Not a focus of this project
5. [#114](https://github.com/NiklasPor/prettier-plugin-go-template/issues/114) Could not reproduce the issue
6. [#115](https://github.com/NiklasPor/prettier-plugin-go-template/issues/115) Could not reproduce the issue
7. [#116](https://github.com/NiklasPor/prettier-plugin-go-template/issues/116) This is an HTML parser issue, unrelated to this project
8. [#33](https://github.com/NiklasPor/prettier-plugin-go-template/issues/33) Too much work for too few reports; better to fix #102 first
9. [#119](https://github.com/NiklasPor/prettier-plugin-go-template/issues/119) Too much work for too few reports; better to fix #102 first
10. [#120](https://github.com/NiklasPor/prettier-plugin-go-template/issues/120) Too much work for too few reports; better to fix #102 first — the reason is that go-template node IDs currently have no awareness of each other, so dynamic nodes aren't supported
11. [#121](https://github.com/NiklasPor/prettier-plugin-go-template/issues/121) Too much work for too few reports; better to fix #102 first
12. [#124](https://github.com/NiklasPor/prettier-plugin-go-template/issues/124) Could not reproduce the issue

## License

MIT
