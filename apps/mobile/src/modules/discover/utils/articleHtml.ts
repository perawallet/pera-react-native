/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Parser, parseDocument } from "htmlparser2";
import type { Nullable } from "@perawallet/wallet-core-shared";
import { toValidatedBrowserUrl } from "@modules/webview";

export type ArticleText = {
  type: "text";
  value: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
};

export type ArticleInline =
  | ArticleText
  | { type: "link"; href: string; children: ArticleInline[] }
  | { type: "break" };

export type ArticleBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      children: ArticleInline[];
    }
  | { type: "paragraph"; children: ArticleInline[] }
  | { type: "list"; ordered: boolean; start: number; items: ArticleBlock[][] }
  | { type: "image"; src: string; alt: string }
  | { type: "quote"; children: ArticleBlock[] }
  | { type: "code"; text: string }
  | { type: "rule" };

// Taken from htmlparser2's own result, so domhandler (its dependency) stays out of the imports.
type ChildNode = ReturnType<typeof parseDocument>["children"][number];
type Element = Extract<ChildNode, { attribs: Record<string, string> }>;

type Marks = Pick<ArticleText, "bold" | "italic" | "code">;
type InlinePiece = ArticleInline | { type: "image"; src: string; alt: string };

const NO_MARKS: Marks = { bold: false, italic: false, code: false };

// Their content is not article text, so they go with everything inside them.
const DROPPED = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "head",
]);
// Block containers the Markdown never emits but raw HTML can: walked as blocks,
// so their text does not run into a neighbour's paragraph.
const CONTAINERS = new Set([
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "details",
  "summary",
  "center",
  "body",
  "html",
]);
const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

const isElement = (node: ChildNode): node is Element => node.type === "tag";

const textOf = (node: ChildNode): string => {
  if (node.type === "text") return node.data;
  // htmlparser2 types script and style nodes as their own kinds, not 'tag'.
  if ("name" in node && DROPPED.has(node.name)) return "";
  if ("children" in node) return node.children.map(textOf).join("");
  return "";
};

// An ordered list's first number, from its `start` attribute when it has one.
const listStart = (list: Element): number => {
  const start = Number.parseInt(list.attribs.start ?? "", 10);
  return Number.isFinite(start) ? start : 1;
};

/** Inline pieces of `nodes`, with HTML whitespace collapsing; images stay in the stream so callers can lift them. */
const collectInline = (
  nodes: readonly ChildNode[],
  marks: Marks,
  out: InlinePiece[],
): void => {
  for (const node of nodes) {
    if (node.type === "text") {
      const value = node.data.replace(/\s+/g, " ");
      if (value !== "") out.push({ type: "text", value, ...marks });
      continue;
    }
    if (!isElement(node) || DROPPED.has(node.name)) continue;
    switch (node.name) {
      case "strong":
      case "b": {
        collectInline(node.children, { ...marks, bold: true }, out);
        break;
      }
      case "em":
      case "i": {
        collectInline(node.children, { ...marks, italic: true }, out);
        break;
      }
      case "code": {
        collectInline(node.children, { ...marks, code: true }, out);
        break;
      }
      case "br": {
        out.push({ type: "break" });
        break;
      }
      case "img": {
        const src = node.attribs.src;
        // Martor turns :rocket: into a small emoji image inside the
        // sentence; keep it as its shortcode rather than a full-width image.
        if ((node.attribs.class ?? "").includes("emoji")) {
          const name =
            node.attribs.alt?.replace(/:/g, "") ||
            src
              ?.split("/")
              .pop()
              ?.replace(/\.\w+$/, "");
          if (name) out.push({ type: "text", value: `:${name}:`, ...marks });
        } else if (src) {
          out.push({
            type: "image",
            src,
            alt: node.attribs.alt ?? "",
          });
        }
        break;
      }
      case "a": {
        const children: InlinePiece[] = [];
        collectInline(node.children, marks, children);
        const inline = children.filter(
          (piece): piece is ArticleInline => piece.type !== "image",
        );
        const href = node.attribs.href;
        if (href) out.push({ type: "link", href, children: inline });
        else out.push(...inline);
        // A linked image (Markdown's clickable image) is still lifted into
        // its own block; it shows, it just does not carry the link.
        out.push(...children.filter((piece) => piece.type === "image"));
        break;
      }
      default: {
        collectInline(node.children, marks, out);
      }
    }
  }
};

const sameMarks = (a: ArticleText, b: ArticleText) =>
  a.bold === b.bold && a.italic === b.italic && a.code === b.code;

const lastTextOf = (pieces: readonly ArticleInline[]): string => {
  const last = pieces.at(-1);
  if (last?.type === "text") return last.value;
  if (last?.type === "link") return lastTextOf(last.children);
  return "";
};

/**
 * Merges runs and drops a space after a space. A block's run (`isBlock`) also
 * trims its ends and is `[]` when nothing visible is left; a link's children
 * keep their edge spaces, which separate the link from its neighbours.
 */
const tidyInline = (
  pieces: readonly ArticleInline[],
  isBlock = true,
): ArticleInline[] => {
  const out: ArticleInline[] = [];
  let endsWithSpace = isBlock;
  for (const piece of pieces) {
    if (piece.type === "text") {
      const value: string = endsWithSpace
        ? piece.value.replace(/^ /, "")
        : piece.value;
      if (value === "") continue;
      const last = out.at(-1);
      if (last?.type === "text" && sameMarks(last, piece)) {
        out[out.length - 1] = { ...last, value: last.value + value };
      } else {
        out.push({ ...piece, value });
      }
      endsWithSpace = value.endsWith(" ");
    } else if (piece.type === "link") {
      let children = tidyInline(piece.children, false);
      const first = children[0];
      if (endsWithSpace && first?.type === "text") {
        const value = first.value.replace(/^ /, "");
        children = value
          ? [{ ...first, value }, ...children.slice(1)]
          : children.slice(1);
      }
      if (!children.some((child) => child.type !== "break")) continue;
      out.push({ ...piece, children });
      endsWithSpace = lastTextOf(children).endsWith(" ");
    } else {
      out.push(piece);
      endsWithSpace = true;
    }
  }
  if (!isBlock) return out;
  const last = out.at(-1);
  if (last?.type === "text") {
    const value = last.value.replace(/ $/, "");
    if (value === "") out.pop();
    else out[out.length - 1] = { ...last, value };
  }
  return out.some((piece) => piece.type !== "break") ? out : [];
};

/** An inline run as blocks: `make` wraps each stretch between images, images become their own blocks. */
const inlineToBlocks = (
  pieces: readonly InlinePiece[],
  make: (children: ArticleInline[]) => ArticleBlock,
): ArticleBlock[] => {
  const blocks: ArticleBlock[] = [];
  let run: ArticleInline[] = [];
  const flush = () => {
    const children = tidyInline(run);
    if (children.length > 0) blocks.push(make(children));
    run = [];
  };
  for (const piece of pieces) {
    if (piece.type === "image") {
      flush();
      blocks.push(piece);
    } else {
      run.push(piece);
    }
  }
  flush();
  return blocks;
};

const paragraph = (children: ArticleInline[]): ArticleBlock => ({
  type: "paragraph",
  children,
});

const collectBlocks = (nodes: readonly ChildNode[]): ArticleBlock[] => {
  const blocks: ArticleBlock[] = [];
  let loose: InlinePiece[] = [];
  const flushLoose = () => {
    blocks.push(...inlineToBlocks(loose, paragraph));
    loose = [];
  };
  for (const node of nodes) {
    if (!isElement(node)) {
      collectInline([node], NO_MARKS, loose);
      continue;
    }
    const { name } = node;
    if (DROPPED.has(name)) continue;
    const level = HEADINGS[name];
    if (level !== undefined) {
      flushLoose();
      const pieces: InlinePiece[] = [];
      collectInline(node.children, NO_MARKS, pieces);
      blocks.push(
        ...inlineToBlocks(pieces, (children) => ({
          type: "heading",
          level,
          children,
        })),
      );
    } else if (name === "p") {
      flushLoose();
      const pieces: InlinePiece[] = [];
      collectInline(node.children, NO_MARKS, pieces);
      blocks.push(...inlineToBlocks(pieces, paragraph));
    } else if (name === "ul" || name === "ol") {
      flushLoose();
      const items = node.children
        .filter(
          (child): child is Element => isElement(child) && child.name === "li",
        )
        .map((item) => collectBlocks(item.children))
        .filter((item) => item.length > 0);
      if (items.length > 0) {
        const ordered = name === "ol";
        blocks.push({
          type: "list",
          ordered,
          start: ordered ? listStart(node) : 1,
          items,
        });
      }
    } else if (name === "blockquote") {
      flushLoose();
      const children = collectBlocks(node.children);
      if (children.length > 0) blocks.push({ type: "quote", children });
    } else if (name === "pre") {
      flushLoose();
      const text = textOf(node).replace(/\n+$/, "");
      if (text.trim() !== "") blocks.push({ type: "code", text });
    } else if (name === "hr") {
      flushLoose();
      blocks.push({ type: "rule" });
    } else if (CONTAINERS.has(name)) {
      flushLoose();
      blocks.push(...collectBlocks(node.children));
    } else {
      collectInline([node], NO_MARKS, loose);
    }
  }
  flushLoose();
  return blocks;
};

/**
 * The news article's HTML as native blocks. The backend renders Markdown with
 * HTML escaping off, so raw HTML can arrive: tags outside this mapping keep
 * their text, and script-like tags are dropped with their content.
 */
export const parseArticleHtml = (html: string): ArticleBlock[] =>
  collectBlocks(parseDocument(html).children);

/**
 * The article's visible text, for when `parseArticleHtml` fails. The streaming
 * parser does not recurse, decodes every entity and drops the same tags.
 */
export const articleHtmlToPlainText = (html: string): string => {
  let dropDepth = 0;
  let text = "";
  const parser = new Parser({
    onopentagname: (name) => {
      if (dropDepth > 0 || DROPPED.has(name)) dropDepth += 1;
      else text += " ";
    },
    onclosetag: (_name, isImplied) => {
      if (dropDepth > 0) dropDepth -= 1;
      else if (!isImplied) text += " ";
    },
    ontext: (data) => {
      if (dropDepth === 0) text += data;
    },
  });
  parser.write(html);
  parser.end();
  return text.replace(/\s+/g, " ").trim();
};

/**
 * The URL an article link opens, or null when it should stay plain text: only
 * an explicit https link that passes the in-app browser's own check. A bare or
 * relative href would otherwise be completed to https by that check.
 */
export const toArticleLinkUrl = (href: string): Nullable<string> =>
  /^https:\/\//i.test(href.trim()) ? toValidatedBrowserUrl(href) : null;
