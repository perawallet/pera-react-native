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

import { describe, expect, it } from "vitest";
import {
  articleHtmlToPlainText,
  parseArticleHtml,
  toArticleLinkUrl,
} from "../articleHtml";

type Marks = Partial<Record<"bold" | "italic" | "code", boolean>>;
const text = (value: string, marks: Marks = {}) => ({
  type: "text",
  value,
  bold: false,
  italic: false,
  code: false,
  ...marks,
});

describe("parseArticleHtml", () => {
  it("maps headings and paragraphs with bold and italic runs", () => {
    expect(
      parseArticleHtml("<h2>Title</h2><p>a <strong>b</strong> <em>c</em></p>"),
    ).toEqual([
      { type: "heading", level: 2, children: [text("Title")] },
      {
        type: "paragraph",
        children: [
          text("a "),
          text("b", { bold: true }),
          text(" "),
          text("c", { italic: true }),
        ],
      },
    ]);
  });

  it("maps unordered and ordered lists, with paragraphs inside items", () => {
    expect(
      parseArticleHtml(
        "<ul><li>x</li><li><p>y</p></li></ul><ol><li>z</li></ol>",
      ),
    ).toEqual([
      {
        type: "list",
        ordered: false,
        start: 1,
        items: [
          [{ type: "paragraph", children: [text("x")] }],
          [{ type: "paragraph", children: [text("y")] }],
        ],
      },
      {
        type: "list",
        ordered: true,
        start: 1,
        items: [[{ type: "paragraph", children: [text("z")] }]],
      },
    ]);
  });

  it("keeps a link with its href, whatever the scheme", () => {
    expect(
      parseArticleHtml(
        '<p><a href="https://x.io/p">go</a> <a href="javascript:alert(1)">bad</a></p>',
      ),
    ).toEqual([
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            href: "https://x.io/p",
            children: [text("go")],
          },
          text(" "),
          {
            type: "link",
            href: "javascript:alert(1)",
            children: [text("bad")],
          },
        ],
      },
    ]);
  });

  it("lifts an image out of its paragraph into its own block", () => {
    expect(
      parseArticleHtml(
        '<p>before<img src="https://pera.test/i.png" alt="i">after</p>',
      ),
    ).toEqual([
      { type: "paragraph", children: [text("before")] },
      { type: "image", src: "https://pera.test/i.png", alt: "i" },
      { type: "paragraph", children: [text("after")] },
    ]);
  });

  it("maps quotes, code blocks, rules and line breaks", () => {
    expect(
      parseArticleHtml(
        "<blockquote><p>q</p></blockquote><pre><code>a\n  b</code></pre><hr><p>a<br>b <code>c</code></p>",
      ),
    ).toEqual([
      {
        type: "quote",
        children: [{ type: "paragraph", children: [text("q")] }],
      },
      { type: "code", text: "a\n  b" },
      { type: "rule" },
      {
        type: "paragraph",
        children: [
          text("a"),
          { type: "break" },
          text("b "),
          text("c", { code: true }),
        ],
      },
    ]);
  });

  it("decodes entities and collapses whitespace", () => {
    expect(parseArticleHtml("<p>  Tom &amp;\n   Jerry  </p>")).toEqual([
      { type: "paragraph", children: [text("Tom & Jerry")] },
    ]);
  });

  it("drops script, style and iframe with their content", () => {
    expect(
      parseArticleHtml(
        '<script>alert(1)</script><style>p{}</style><iframe src="https://e.io"></iframe>',
      ),
    ).toEqual([]);
  });

  it("unwraps unknown tags and wraps loose text in a paragraph", () => {
    expect(parseArticleHtml("<div><span>t</span></div>loose")).toEqual([
      { type: "paragraph", children: [text("t")] },
      { type: "paragraph", children: [text("loose")] },
    ]);
  });

  it("numbers an ordered list from its start attribute", () => {
    expect(parseArticleHtml('<ol start="4"><li>d</li></ol>')).toEqual([
      {
        type: "list",
        ordered: true,
        start: 4,
        items: [[{ type: "paragraph", children: [text("d")] }]],
      },
    ]);
    expect(parseArticleHtml('<ol start="x"><li>d</li></ol>')).toMatchObject([
      { start: 1 },
    ]);
  });

  it("keeps script and style out of a code block", () => {
    expect(
      parseArticleHtml(
        "<pre><script>track()</script><style>p{}</style>const a = 1</pre>",
      ),
    ).toEqual([{ type: "code", text: "const a = 1" }]);
  });

  it("returns no blocks for empty or blank HTML", () => {
    expect(parseArticleHtml("")).toEqual([]);
    expect(parseArticleHtml("  \n ")).toEqual([]);
    expect(parseArticleHtml("<p> </p>")).toEqual([]);
  });
});

describe("parseArticleHtml edge cases", () => {
  it("lifts an image inside a link into its own block", () => {
    expect(
      parseArticleHtml(
        '<p><a href="https://x.io"><img src="https://pera.test/b.png" alt="b"></a></p>',
      ),
    ).toEqual([{ type: "image", src: "https://pera.test/b.png", alt: "b" }]);
  });

  it("keeps an emoji image inline as its shortcode", () => {
    expect(
      parseArticleHtml(
        '<p>Launch <img class="marked-emoji" src="https://github.githubassets.com/images/icons/emoji/rocket.png"> now</p>',
      ),
    ).toEqual([{ type: "paragraph", children: [text("Launch :rocket: now")] }]);
  });

  it("keeps the spaces at the edges of a link", () => {
    expect(
      parseArticleHtml(
        '<p>Read<a href="https://x.io"> more</a> and <a href="https://y.io">foo </a>bar</p>',
      ),
    ).toEqual([
      {
        type: "paragraph",
        children: [
          text("Read"),
          {
            type: "link",
            href: "https://x.io",
            children: [text(" more")],
          },
          text(" and "),
          {
            type: "link",
            href: "https://y.io",
            children: [text("foo ")],
          },
          text("bar"),
        ],
      },
    ]);
  });
});

describe("toArticleLinkUrl", () => {
  it("keeps an explicit https link", () => {
    expect(toArticleLinkUrl("https://x.io/a")).toBe("https://x.io/a");
  });

  it.each(["javascript:alert(1)", "http://x.io", "/relative", "x.io", ""])(
    "refuses %s",
    (href) => {
      expect(toArticleLinkUrl(href)).toBeNull();
    },
  );
});

describe("articleHtmlToPlainText", () => {
  it("keeps the visible text, separating blocks with a space", () => {
    expect(
      articleHtmlToPlainText("<h1>Title</h1><p>One <b>two</b></p><p>three</p>"),
    ).toBe("Title One two three");
  });

  it("decodes every entity, named or numeric", () => {
    expect(
      articleHtmlToPlainText("<p>it&#x27;s &rsquo;a&mdash;b&amp;c&#60;</p>"),
    ).toBe("it's \u2019a\u2014b&c<");
  });

  it("drops the parser's dropped tags with their content", () => {
    expect(
      articleHtmlToPlainText(
        "<head><title>draft</title></head><script>x()</script><style>p{}</style><noscript>n</noscript><p>kept</p>",
      ),
    ).toBe("kept");
  });

  it("returns an empty string for markup without text", () => {
    expect(articleHtmlToPlainText("<div><br></div>")).toBe("");
  });
});
