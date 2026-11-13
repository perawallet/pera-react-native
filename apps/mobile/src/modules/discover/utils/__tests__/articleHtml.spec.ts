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

import { describe, expect, it } from 'vitest'
import { parseArticleHtml } from '../articleHtml'

type Marks = Partial<Record<'bold' | 'italic' | 'code', boolean>>
const text = (value: string, marks: Marks = {}) => ({
    type: 'text',
    value,
    bold: false,
    italic: false,
    code: false,
    ...marks,
})

describe('parseArticleHtml', () => {
    it('maps headings and paragraphs with bold and italic runs', () => {
        expect(
            parseArticleHtml(
                '<h2>Title</h2><p>a <strong>b</strong> <em>c</em></p>',
            ),
        ).toEqual([
            { type: 'heading', level: 2, children: [text('Title')] },
            {
                type: 'paragraph',
                children: [
                    text('a '),
                    text('b', { bold: true }),
                    text(' '),
                    text('c', { italic: true }),
                ],
            },
        ])
    })

    it('maps unordered and ordered lists, with paragraphs inside items', () => {
        expect(
            parseArticleHtml(
                '<ul><li>x</li><li><p>y</p></li></ul><ol><li>z</li></ol>',
            ),
        ).toEqual([
            {
                type: 'list',
                ordered: false,
                items: [
                    [{ type: 'paragraph', children: [text('x')] }],
                    [{ type: 'paragraph', children: [text('y')] }],
                ],
            },
            {
                type: 'list',
                ordered: true,
                items: [[{ type: 'paragraph', children: [text('z')] }]],
            },
        ])
    })

    it('keeps a link with its href, whatever the scheme', () => {
        expect(
            parseArticleHtml(
                '<p><a href="https://x.io/p">go</a> <a href="javascript:alert(1)">bad</a></p>',
            ),
        ).toEqual([
            {
                type: 'paragraph',
                children: [
                    {
                        type: 'link',
                        href: 'https://x.io/p',
                        children: [text('go')],
                    },
                    text(' '),
                    {
                        type: 'link',
                        href: 'javascript:alert(1)',
                        children: [text('bad')],
                    },
                ],
            },
        ])
    })

    it('lifts an image out of its paragraph into its own block', () => {
        expect(
            parseArticleHtml(
                '<p>before<img src="https://pera.test/i.png" alt="i">after</p>',
            ),
        ).toEqual([
            { type: 'paragraph', children: [text('before')] },
            { type: 'image', src: 'https://pera.test/i.png', alt: 'i' },
            { type: 'paragraph', children: [text('after')] },
        ])
    })

    it('maps quotes, code blocks, rules and line breaks', () => {
        expect(
            parseArticleHtml(
                '<blockquote><p>q</p></blockquote><pre><code>a\n  b</code></pre><hr><p>a<br>b <code>c</code></p>',
            ),
        ).toEqual([
            {
                type: 'quote',
                children: [{ type: 'paragraph', children: [text('q')] }],
            },
            { type: 'code', text: 'a\n  b' },
            { type: 'rule' },
            {
                type: 'paragraph',
                children: [
                    text('a'),
                    { type: 'break' },
                    text('b '),
                    text('c', { code: true }),
                ],
            },
        ])
    })

    it('decodes entities and collapses whitespace', () => {
        expect(parseArticleHtml('<p>  Tom &amp;\n   Jerry  </p>')).toEqual([
            { type: 'paragraph', children: [text('Tom & Jerry')] },
        ])
    })

    it('drops script, style and iframe with their content', () => {
        expect(
            parseArticleHtml(
                '<script>alert(1)</script><style>p{}</style><iframe src="https://e.io"></iframe>',
            ),
        ).toEqual([])
    })

    it('unwraps unknown tags and wraps loose text in a paragraph', () => {
        expect(parseArticleHtml('<div><span>t</span></div>loose')).toEqual([
            { type: 'paragraph', children: [text('t')] },
            { type: 'paragraph', children: [text('loose')] },
        ])
    })

    it('returns no blocks for empty or blank HTML', () => {
        expect(parseArticleHtml('')).toEqual([])
        expect(parseArticleHtml('  \n ')).toEqual([])
        expect(parseArticleHtml('<p> </p>')).toEqual([])
    })
})
