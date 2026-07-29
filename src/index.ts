import constants from "./constants";
import languagesList from "./languages";
import goTemplateParser from "./parsers";
import goTemplatePrinter from "./printers";
import type { GoNode } from "./ast";
import type { Parser, Printer } from "prettier";

export const languages = languagesList;

export const parsers: { [key: string]: Parser<GoNode> } = {
  [constants.PLUGIN_KEY]: goTemplateParser,
};

export const printers: { [key: string]: Printer<GoNode> } = {
  [constants.PLUGIN_KEY]: goTemplatePrinter,
};
