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

import { describe, expect, it, vi } from 'vitest'
import { noUnvalidatedOpenUrl } from '../rules/no-unvalidated-open-url.js'
import { call, id, member, type Node } from './helpers.js'

type Scope = { set: Map<string, unknown>; upper: Scope | null }

const literal = (value: string): Node => ({ type: 'Literal', value })
const property = (key: string, value: Node, shorthand = false): Node => ({
    type: 'Property',
    computed: false,
    shorthand,
    key: id(key),
    value,
})
const object = (...properties: Node[]): Node => ({
    type: 'ObjectExpression',
    properties,
})
const array = (...elements: Node[]): Node => ({
    type: 'ArrayExpression',
    elements,
})
const logical = (operator: string, left: Node, right: Node): Node => ({
    type: 'LogicalExpression',
    operator,
    left,
    right,
})
const attribute = (name: string, value: Node | null): Node => ({
    type: 'JSXAttribute',
    name: { type: 'JSXIdentifier', name },
    value,
})
const expressionAttribute = (name: string, expression: Node): Node =>
    attribute(name, { type: 'JSXExpressionContainer', expression })
const element = (name: string, ...attributes: Node[]): Node => ({
    type: 'JSXOpeningElement',
    name: { type: 'JSXIdentifier', name },
    attributes,
})

const constScope = (name: string, init: Node, kind = 'const'): Scope => ({
    set: new Map([
        [
            name,
            {
                defs: [
                    {
                        type: 'Variable',
                        node: {
                            type: 'VariableDeclarator',
                            id: id(name),
                            init,
                        },
                        parent: { kind },
                    },
                ],
            },
        ],
    ]),
    upper: null,
})
const emptyScope: Scope = { set: new Map(), upper: null }

const lint = (
    visitor: 'CallExpression' | 'JSXOpeningElement',
    node: Node,
    scope = emptyScope,
) => {
    const report = vi.fn()
    const rule = noUnvalidatedOpenUrl.create({
        report,
        sourceCode: { getScope: () => scope },
    })
    rule[visitor](node)
    return report
}

const toValidated = (argument: Node = id('raw')) =>
    call(id('toValidatedBrowserUrl'), [argument])

type Sink = {
    label: string
    name: string
    visitor: 'CallExpression' | 'JSXOpeningElement'
    build: (url: Node) => Node
}

const sinks: Sink[] = [
    {
        label: 'Linking.openURL(x)',
        name: 'Linking.openURL',
        visitor: 'CallExpression',
        build: url => call(member(id('Linking'), 'openURL'), [url]),
    },
    {
        label: 'pushWebView({ url: x })',
        name: 'pushWebView',
        visitor: 'CallExpression',
        build: url => call(id('pushWebView'), [object(property('url', url))]),
    },
    {
        label: 'store.pushWebView({ url: x })',
        name: 'pushWebView',
        visitor: 'CallExpression',
        build: url =>
            call(member(id('store'), 'pushWebView'), [
                object(property('url', url)),
            ]),
    },
    {
        label: 'openSystemBrowser({ url: x })',
        name: 'openSystemBrowser',
        visitor: 'CallExpression',
        build: url =>
            call(id('openSystemBrowser'), [object(property('url', url))]),
    },
    {
        label: '<PWWebView url={x}>',
        name: '<PWWebView url>',
        visitor: 'JSXOpeningElement',
        build: url => element('PWWebView', expressionAttribute('url', url)),
    },
    {
        label: '<WebView source={{ uri: x }}>',
        name: '<WebView source>',
        visitor: 'JSXOpeningElement',
        build: url =>
            element(
                'WebView',
                expressionAttribute('source', object(property('uri', url))),
            ),
    },
    {
        label: '<PWStaticWebView source={{ uri: x }}>',
        name: '<PWStaticWebView source>',
        visitor: 'JSXOpeningElement',
        build: url =>
            element(
                'PWStaticWebView',
                expressionAttribute('source', object(property('uri', url))),
            ),
    },
]

const trusted: [string, Node, Scope?][] = [
    ['a string literal', literal('https://x')],
    [
        'a template without expressions',
        { type: 'TemplateLiteral', expressions: [] },
    ],
    ['a config member', member(member(id('config'), 'urls'), 'support')],
    [
        'withLanguageParam over a config member',
        call(id('withLanguageParam'), [member(id('config'), 'a'), id('lang')]),
    ],
    [
        'a const from toValidatedBrowserUrl',
        id('x'),
        constScope('x', toValidated()),
    ],
    [
        'toValidatedBrowserUrl(raw) ?? config.a',
        logical('??', toValidated(), member(id('config'), 'a')),
    ],
]

const untrusted: [string, Node, Scope?][] = [
    ['an unbound identifier', id('url')],
    [
        'a let from toValidatedBrowserUrl',
        id('x'),
        constScope('x', toValidated(), 'let'),
    ],
    ['a non-config member', member(id('peer'), 'url')],
    [
        'a template with expressions',
        { type: 'TemplateLiteral', expressions: [id('x')] },
    ],
    [
        'withLanguageParam over an untrusted base',
        call(id('withLanguageParam'), [member(id('peer'), 'url'), id('lang')]),
    ],
    [
        'toValidatedBrowserUrl(raw) ?? peer.url',
        logical('??', toValidated(), member(id('peer'), 'url')),
    ],
]

describe('pera/no-unvalidated-open-url', () => {
    describe.each(sinks)('$label', ({ name, visitor, build }) => {
        it.each(trusted)('allows %s', (_label, url, scope) => {
            expect(lint(visitor, build(url), scope)).not.toHaveBeenCalled()
        })

        it.each(untrusted)('reports %s', (_label, url, scope) => {
            expect(lint(visitor, build(url), scope)).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageId: 'unvalidated',
                    data: { sink: name },
                }),
            )
        })
    })

    it.each([
        [
            'pushWebView({ id })',
            call(id('pushWebView'), [object(property('id', id('x')))]),
        ],
        ['pushWebView(view)', call(id('pushWebView'), [id('view')])],
        ['pushWebView()', call(id('pushWebView'), [])],
        ['Linking.openURL()', call(member(id('Linking'), 'openURL'), [])],
    ])('reports %s', (_label, node) => {
        expect(lint('CallExpression', node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'unvalidated' }),
        )
    })

    it('checks a shorthand url property through its binding', () => {
        const node = call(id('pushWebView'), [
            object(property('url', id('url'), true)),
        ])

        expect(
            lint('CallExpression', node, constScope('url', toValidated())),
        ).not.toHaveBeenCalled()
        expect(lint('CallExpression', node)).toHaveBeenCalled()
    })

    it('finds the const through an upper scope', () => {
        const inner: Scope = {
            set: new Map(),
            upper: constScope('x', toValidated()),
        }

        expect(
            lint(
                'CallExpression',
                call(id('openSystemBrowser'), [id('x')]),
                inner,
            ),
        ).not.toHaveBeenCalled()
    })

    it('does not follow a const chain past the depth cap', () => {
        const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
        const set = new Map<string, unknown>()
        names.forEach((name, index) => {
            const next = names[index + 1]
            const init = next ? id(next) : toValidated()
            set.set(name, constScope(name, init).set.get(name))
        })

        expect(
            lint('CallExpression', call(id('pushWebView'), [id('a')]), {
                set,
                upper: null,
            }),
        ).toHaveBeenCalled()
    })

    it('does not trust a name declared twice', () => {
        const [only] = [
            constScope('x', toValidated()).set.get('x') as { defs: unknown[] },
        ]
        const scope: Scope = {
            set: new Map([['x', { defs: [only.defs[0], only.defs[0]] }]]),
            upper: null,
        }

        expect(
            lint('CallExpression', call(id('pushWebView'), [id('x')]), scope),
        ).toHaveBeenCalled()
    })

    it('ignores another object’s openURL and unrelated components', () => {
        expect(
            lint(
                'CallExpression',
                call(member(id('Other'), 'openURL'), [id('url')]),
            ),
        ).not.toHaveBeenCalled()
        expect(
            lint(
                'JSXOpeningElement',
                element('Other', expressionAttribute('url', id('x'))),
            ),
        ).not.toHaveBeenCalled()
    })

    describe('WebView source and url attributes', () => {
        it('allows a source with no uri', () => {
            const node = element(
                'WebView',
                expressionAttribute(
                    'source',
                    object(property('html', id('html'))),
                ),
            )

            expect(lint('JSXOpeningElement', node)).not.toHaveBeenCalled()
        })

        it.each(['WebView', 'PWStaticWebView'])(
            'reports a %s source that is not an object literal',
            component => {
                const node = element(
                    component,
                    expressionAttribute('source', id('source')),
                )

                expect(lint('JSXOpeningElement', node)).toHaveBeenCalledWith(
                    expect.objectContaining({
                        messageId: 'unvalidated',
                        data: { sink: `<${component} source>` },
                    }),
                )
            },
        )

        it('treats a string url attribute as a literal', () => {
            const node = element(
                'PWWebView',
                attribute('url', literal('https://x')),
            )

            expect(lint('JSXOpeningElement', node)).not.toHaveBeenCalled()
        })

        it('reports on the attribute, so a suppression sits inside the tag', () => {
            const urlAttribute = expressionAttribute('url', id('x'))
            const report = lint(
                'JSXOpeningElement',
                element('PWWebView', urlAttribute),
            )

            expect(report).toHaveBeenCalledWith(
                expect.objectContaining({ node: urlAttribute }),
            )
        })
    })

    describe.each(['WebView', 'PWStaticWebView', 'PWWebView'])(
        '%s props',
        component => {
            it.each([
                ['originWhitelist={["*"]}', array(literal('*'))],
                [
                    'originWhitelist={["https://*", "*"]}',
                    array(literal('https://*'), literal('*')),
                ],
            ])('reports %s', (_label, whitelist) => {
                const node = element(
                    component,
                    expressionAttribute('originWhitelist', whitelist),
                )

                expect(lint('JSXOpeningElement', node)).toHaveBeenCalledWith(
                    expect.objectContaining({
                        messageId: 'wildcardOrigin',
                        data: { component },
                    }),
                )
            })

            it('allows an https-only originWhitelist', () => {
                const node = element(
                    component,
                    expressionAttribute(
                        'originWhitelist',
                        array(literal('https://*')),
                    ),
                )

                expect(lint('JSXOpeningElement', node)).not.toHaveBeenCalled()
            })

            it.each([
                [
                    'an attribute string',
                    attribute('mixedContentMode', literal('always')),
                ],
                [
                    'an expression',
                    expressionAttribute('mixedContentMode', literal('always')),
                ],
            ])("reports mixedContentMode='always' as %s", (_label, mixed) => {
                expect(
                    lint('JSXOpeningElement', element(component, mixed)),
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        messageId: 'mixedContentAlways',
                        data: { component },
                    }),
                )
            })

            it("allows mixedContentMode='never'", () => {
                const node = element(
                    component,
                    attribute('mixedContentMode', literal('never')),
                )

                expect(lint('JSXOpeningElement', node)).not.toHaveBeenCalled()
            })
        },
    )
})
