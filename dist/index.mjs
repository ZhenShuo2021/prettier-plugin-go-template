import { ulid } from "ulid";
import { doc } from "prettier";
import pkg from "prettier/doc.js";
//#region src/constants.ts
const constants = { PLUGIN_KEY: "go-template" };
//#endregion
//#region src/languages.ts
const languages$1 = [{
	name: "GoTemplate",
	parsers: [constants.PLUGIN_KEY],
	extensions: [
		".go.html",
		".gohtml",
		".gotmpl",
		".go.tmpl",
		".tmpl",
		".tpl",
		".html.tmpl",
		".html.tpl"
	],
	vscodeLanguageIds: [
		"gotemplate",
		"gohtml",
		"GoTemplate",
		"GoHTML"
	]
}];
//#endregion
//#region src/ast.ts
const astGuards = {
	isBlock(node) {
		return node.type === "block";
	},
	isMultiBlock(node) {
		return node.type === "double-block";
	},
	isRoot(node) {
		return node.type === "root";
	}
};
//#endregion
//#region src/utils.ts
function createIdGenerator() {
	return () => ulid();
}
function last(array) {
	return array[array.length - 1];
}
//#endregion
//#region src/parsers.ts
const parseGoTemplate = (text) => {
	const TRIM_START = String.raw`(?<trimStart>-)?`;
	const TRIM_END = String.raw`(?<trimEnd>-)?`;
	const START_DELIMITER = String.raw`(?<startdelimiter><|%)?`;
	const END_DELIMITER = String.raw`(?<endDelimiter>>|%)?`;
	const makeKeyword = (groupName) => String.raw`(?<${groupName}>if|range|block|with|define|end|else|prettier-ignore-start|prettier-ignore-end)?`;
	const KEYWORD = makeKeyword("keyword");
	const INLINE_FORMATTABLE_TEMPLATE = String.raw`{{${TRIM_START}\s*${START_DELIMITER}(?<leadingWs>\s*)(?<statement>${KEYWORD}[\s\S]*?)(?<trailingWs>\s*)${END_DELIMITER}\s*${TRIM_END}}}`;
	const INLINE_COMMENT_TEMPLATE = String.raw`{{(?<trimStartComment>-)?\s*\/\*(?<leadingWsComment>\s*)(?<commentStatement>${makeKeyword("keywordComment")}[\s\S]*?)(?<trailingWsComment>\s*)\*\/\s*(?<trimEndComment>-)?}}`;
	const buildUnformattableTag = (tagName, groupName) => String.raw`(?<${groupName}><(${tagName})((?!<)[\s\S])*>((?!<\/${tagName})[\s\S])*?{{[\s\S]*?<\/(${tagName})>)`;
	const UNFORMATTABLE_SCRIPT = buildUnformattableTag("script", "unformattableScript");
	const UNFORMATTABLE_STYLE = buildUnformattableTag("style", "unformattableStyle");
	const GO_TEMPLATE_REGEX = new RegExp([
		INLINE_COMMENT_TEMPLATE,
		INLINE_FORMATTABLE_TEMPLATE,
		UNFORMATTABLE_SCRIPT,
		UNFORMATTABLE_STYLE
	].join("|"), "g");
	const root = {
		type: "root",
		content: text,
		aliasedContent: "",
		children: {},
		index: 0,
		contentStart: 0,
		length: text.length
	};
	const nodeStack = [root];
	const getId = createIdGenerator();
	for (const match of text.matchAll(GO_TEMPLATE_REGEX)) {
		if (match.index === void 0) throw Error("Regex match index undefined.");
		const current = last(nodeStack);
		if (current === void 0) throw Error("Node stack empty.");
		const unformattable = match.groups?.unformattableScript ?? match.groups?.unformattableStyle;
		const id = getId();
		if (unformattable) {
			current.children[id] = {
				id,
				type: "unformattable",
				index: match.index,
				length: match[0].length,
				content: unformattable,
				parent: current
			};
			continue;
		}
		const isCommentAction = match.groups?.commentStatement !== void 0;
		const statement = isCommentAction ? match.groups?.commentStatement : match.groups?.statement;
		if (statement === void 0) throw Error("Formattable match without statement.");
		const trimStart = (isCommentAction ? match.groups?.trimStartComment : match.groups?.trimStart) ?? "";
		const trimEnd = (isCommentAction ? match.groups?.trimEndComment : match.groups?.trimEnd) ?? "";
		const startDelimiter = isCommentAction ? "/*" : match.groups?.startdelimiter ?? "";
		const endDelimiter = isCommentAction ? "*/" : match.groups?.endDelimiter ?? "";
		const leadingWs = isCommentAction ? match.groups?.leadingWsComment ?? "" : "";
		const trailingWs = isCommentAction ? match.groups?.trailingWsComment ?? "" : "";
		if (!isCommentAction && !isValidStatement(statement)) throw Error("String literal is not closed. Invalid Go template statement");
		const inline = {
			index: match.index,
			length: match[0].length,
			trimStart,
			startDelimiter,
			endDelimiter,
			trimEnd,
			parent: current,
			type: "inline",
			statement,
			isComment: isCommentAction,
			commentLeadingWs: leadingWs,
			commentTrailingWs: trailingWs,
			id
		};
		const rawKeyword = isCommentAction ? match.groups?.keywordComment : match.groups?.keyword;
		const keyword = isCommentAction && !(rawKeyword === "prettier-ignore-start" || rawKeyword === "prettier-ignore-end") ? void 0 : rawKeyword;
		if (keyword === "end" || keyword === "prettier-ignore-end") {
			if (current.type !== "block") throw Error("Encountered unexpected end keyword.");
			current.length = match[0].length + match.index - current.index;
			current.content = text.substring(current.contentStart, match.index);
			current.aliasedContent = aliasNodeContent(current);
			current.end = inline;
			if (current.parent.type === "double-block") {
				const firstChild = current.parent.blocks[0];
				const lastChild = current.parent.blocks[current.parent.blocks.length - 1];
				current.parent.length = lastChild.index + lastChild.length - firstChild.index;
			}
			nodeStack.pop();
		} else if (astGuards.isBlock(current) && keyword === "else") {
			const nextChild = {
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
				trimEnd
			};
			if (astGuards.isMultiBlock(current.parent)) current.parent.blocks.push(nextChild);
			else {
				const multiBlock = {
					type: "double-block",
					parent: current.parent,
					index: current.index,
					length: -1,
					keyword,
					id: current.id,
					blocks: [current, nextChild]
				};
				nextChild.parent = multiBlock;
				current.parent = multiBlock;
				if ("children" in multiBlock.parent) multiBlock.parent.children[multiBlock.id] = multiBlock;
				else throw Error("Could not find child in parent.");
			}
			current.id = getId();
			current.length = match[0].length + match.index - current.index;
			current.content = text.substring(current.contentStart, match.index);
			current.aliasedContent = aliasNodeContent(current);
			nodeStack.pop();
			nodeStack.push(nextChild);
		} else if (keyword) {
			const block = {
				type: "block",
				start: inline,
				end: null,
				children: {},
				keyword,
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
				trimEnd
			};
			current.children[block.id] = block;
			nodeStack.push(block);
		} else current.children[inline.id] = inline;
	}
	if (!astGuards.isRoot(nodeStack.pop())) throw Error("Missing end block.");
	root.aliasedContent = aliasNodeContent(root);
	return root;
};
function aliasNodeContent(current) {
	let result = current.content;
	Object.entries(current.children).sort(([_, node1], [__, node2]) => node2.index - node1.index).forEach(([id, node]) => result = result.substring(0, node.index - current.contentStart) + id + result.substring(node.index + node.length - current.contentStart));
	return result;
}
/**
* Validates the content of a Go template action statement (inside `{{ ... }}`).
* Returns false when it contains an unterminated double-quoted (") or raw (`) string literal.
*/
function isValidStatement(statement) {
	let state = "normal";
	let backslashCount = 0;
	for (const char of statement) if (state === "normal") if (char === "\"") state = "inDouble";
	else if (char === "`") state = "inRaw";
	else continue;
	else if (state === "inRaw") if (char === "`") state = "normal";
	else continue;
	else if (state === "inDouble") {
		if (char === "\"") {
			if (backslashCount % 2 === 0) state = "normal";
		}
		backslashCount = char === "\\" ? backslashCount + 1 : 0;
	}
	return state === "normal";
}
/**
* The plugin's Parser definition for the "go-template" astFormat. Consumed
* (and keyed under the plugin's PLUGIN_KEY) by index.ts, which owns
* assembling the final `parsers` export required by the Prettier plugin API.
*/
const goTemplateParser = {
	astFormat: constants.PLUGIN_KEY,
	preprocess: (text) => text.endsWith("\n") ? text.slice(0, text.length - 1) : text,
	parse: parseGoTemplate,
	locStart: (node) => node.index,
	locEnd: (node) => node.index + node.length
};
//#endregion
//#region src/ast-navigation.ts
function getFirstBlockParent(node) {
	let previous = node;
	let current = node.parent;
	while (!astGuards.isBlock(current) && !astGuards.isRoot(current)) {
		previous = current;
		current = current.parent;
	}
	return {
		child: previous,
		parent: current
	};
}
function isBlockEnd(node) {
	const { parent } = getFirstBlockParent(node);
	return astGuards.isBlock(parent) && parent.end === node;
}
function isBlockStart(node) {
	const { parent } = getFirstBlockParent(node);
	return astGuards.isBlock(parent) && parent.start === node;
}
/**
* Returns the sibling that immediately precedes `node` among its parent's
* direct children (ordered by source position), or undefined if `node` is
* the first child. Used to look up a preceding standalone node — such as a
* `{{/* prettier-ignore *\/}}` comment — without relying on string matching.
*/
function getPreviousSibling(node) {
	if (astGuards.isRoot(node)) return;
	const { parent, child } = getFirstBlockParent(node);
	const siblings = Object.values(parent.children).sort((a, b) => a.index - b.index);
	const position = siblings.indexOf(child);
	return position > 0 ? siblings[position - 1] : void 0;
}
//#endregion
//#region src/ignore.ts
/**
* True when `node` is itself a `{{/* prettier-ignore *\/}}` (or with trim
* markers, `{{- /* prettier-ignore *\/ -}}`) comment node.
*/
function isPrettierIgnoreComment(node) {
	return node.type === "inline" && node.isComment && node.statement.trim() === "prettier-ignore";
}
function hasPrettierIgnoreLine(node) {
	if (astGuards.isRoot(node)) return false;
	const previousSibling = getPreviousSibling(node);
	if (previousSibling && isPrettierIgnoreComment(previousSibling)) return true;
	const { parent, child } = getFirstBlockParent(node);
	const regex = new RegExp(`(?:<!--|{{-?).*?prettier-ignore.*?(?:-->|-?}})\n.*${child.id}`);
	return !!parent.aliasedContent.match(regex);
}
function isPrettierIgnoreBlock(node) {
	return astGuards.isBlock(node) && node.keyword === "prettier-ignore-start";
}
//#endregion
//#region src/printers.ts
const { builders, utils } = pkg;
/**
* The plugin's Printer definition for the "go-template" astFormat. Consumed
* (and keyed under the plugin's PLUGIN_KEY) by index.ts, which owns
* assembling the final `printers` export required by the Prettier plugin API.
*/
const goTemplatePrinter = {
	print: (path, printOptions, print) => {
		const node = path.getNode();
		switch (node?.type) {
			case "inline": return printInline(node, printOptions);
			case "double-block": return printMultiBlock(path, print);
			case "unformattable": return printUnformattable(node, printOptions);
		}
		throw new Error(`An error occured during printing. Found invalid node ${node?.type}.`);
	},
	embed: (path, parserOptions) => {
		return embed(path, parserOptions);
	}
};
const embed = () => {
	return async (textToDoc, print, path, optionsA) => {
		const node = path.getNode();
		const parserOptions = optionsA;
		if (!node) return;
		if (hasPrettierIgnoreLine(node)) return parserOptions.originalText.substring(parserOptions.locStart(node), parserOptions.locEnd(node));
		if (node.type !== "block" && node.type !== "root") return;
		if (isPrettierIgnoreBlock(node)) {
			const startStatement = path.call(print, "start");
			const endStatement = node.end ? path.call(print, "end") : "";
			return [
				utils.removeLines(startStatement),
				printPlainBlock(node.content),
				endStatement
			];
		}
		const html = await textToDoc(node.aliasedContent, {
			...parserOptions,
			parser: "html",
			parentParser: "go-template"
		});
		const mapped = utils.stripTrailingHardline(utils.mapDoc(html, (currentDoc) => {
			if (typeof currentDoc !== "string") return currentDoc;
			let mappedDoc = currentDoc;
			Object.keys(node.children).forEach((key) => mappedDoc = doc.utils.mapDoc(mappedDoc, (docNode) => typeof docNode !== "string" || !docNode.includes(key) ? docNode : [
				docNode.substring(0, docNode.indexOf(key)),
				path.call(print, "children", key),
				docNode.substring(docNode.indexOf(key) + key.length)
			]));
			return mappedDoc;
		}));
		if (astGuards.isRoot(node)) return [mapped, builders.hardline];
		const startStatement = path.call(print, "start");
		const endStatement = node.end ? path.call(print, "end") : "";
		const result = [
			startStatement,
			node.aliasedContent.trim() ? builders.indent([builders.softline, mapped]) : "",
			builders.softline,
			endStatement
		];
		const emptyLine = !!node.end && isFollowedByEmptyLine(node.end, parserOptions.originalText) ? builders.softline : "";
		if (astGuards.isMultiBlock(node.parent)) return [result, emptyLine];
		return builders.group([builders.group(result), emptyLine], { shouldBreak: !!node.end && hasNodeLinebreak(node.end, parserOptions.originalText) });
	};
};
function printMultiBlock(path, print) {
	return path.map(print, "blocks");
}
function printInline(node, parserOptions) {
	const isBlockNode = isBlockEnd(node) || isBlockStart(node);
	const emptyLine = isFollowedByEmptyLine(node, parserOptions.originalText) && isFollowedByNode(node) ? builders.softline : "";
	const result = [printStatement(node.statement, {
		trimStart: node.trimStart,
		start: node.startDelimiter,
		end: node.endDelimiter,
		trimEnd: node.trimEnd
	}, node.isComment, node.commentLeadingWs, node.commentTrailingWs)];
	return builders.group([...result, emptyLine], { shouldBreak: hasNodeLinebreak(node, parserOptions.originalText) && !isBlockNode });
}
function printStatement(statement, delimiter = {
	trimStart: "",
	start: "",
	end: "",
	trimEnd: ""
}, isComment = false, commentLeadingWs = "", commentTrailingWs = "") {
	const space = " ";
	const shouldBreak = statement.includes("\n");
	const trimStartGap = delimiter.trimStart && delimiter.start === "/*" ? " " : "";
	const trimEndGap = delimiter.end === "*/" && delimiter.trimEnd ? " " : "";
	const toLiteralDoc = (raw) => raw.split("\n").flatMap((line, index, array) => index === array.length - 1 ? [line] : [line, builders.literalline]);
	const content = isComment ? [
		...toLiteralDoc(commentLeadingWs),
		...toLiteralDoc(statement),
		...toLiteralDoc(commentTrailingWs)
	] : shouldBreak ? statement.trim().split("\n").map((line, index, array) => index === array.length - 1 ? [line.trim(), builders.softline] : builders.indent([line.trim(), builders.softline])) : [statement.trim()];
	const leadingSpace = isComment ? "" : space;
	const trailingSpace = isComment ? "" : shouldBreak ? "" : space;
	return builders.group([
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
		"}}"
	], { shouldBreak });
}
function printUnformattable(node, targetOpts) {
	const start = targetOpts.originalText.lastIndexOf("\n", node.index - 1);
	return printPlainBlock((targetOpts.originalText.substring(start, node.index + node.length).replace(node.content, "").match(/\s*$/)?.[0] ?? "") + node.content, false);
}
function printPlainBlock(text, hardlines = true) {
	const isTextEmpty = (input) => !!input.match(/^\s*$/);
	const lines = text.split("\n");
	return [...lines.filter((value, i) => !(i === 0 || i === lines.length - 1) || !isTextEmpty(value)).map((content, i) => [
		hardlines || i ? builders.hardline : "",
		builders.trim,
		content
	]), hardlines ? builders.hardline : ""];
}
function hasNodeLinebreak(node, source) {
	const start = node.index + node.length;
	const end = source.indexOf("\n", start);
	return !source.substring(start, end);
}
function isFollowedByEmptyLine(node, source) {
	const start = node.index + node.length;
	const firstLineBreak = source.indexOf("\n", start);
	const secondLineBreak = source.indexOf("\n", firstLineBreak + 1);
	const emptyLine = source.substring(firstLineBreak + 1, secondLineBreak).trim();
	const isLastNode = !!source.substring(start).match(/^\s*$/);
	return firstLineBreak !== -1 && secondLineBreak !== -1 && !emptyLine && !isLastNode;
}
function isFollowedByNode(node) {
	const parent = getFirstBlockParent(node).parent;
	const start = parent.aliasedContent.indexOf(node.id) + node.id.length;
	let nextNodeIndex = -1;
	Object.keys(parent.children).forEach((key) => {
		const index = parent.aliasedContent.indexOf(key, start);
		if (nextNodeIndex === -1 || index < nextNodeIndex) nextNodeIndex = index;
	});
	return !!parent.aliasedContent.substring(start, nextNodeIndex).match(/^\s+$/m);
}
//#endregion
//#region src/index.ts
const languages = languages$1;
const parsers = { [constants.PLUGIN_KEY]: goTemplateParser };
const printers = { [constants.PLUGIN_KEY]: goTemplatePrinter };
//#endregion
export { languages, parsers, printers };
