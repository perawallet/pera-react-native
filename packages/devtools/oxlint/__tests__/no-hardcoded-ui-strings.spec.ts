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
import { noHardcodedUiStrings } from '../rules/no-hardcoded-ui-strings.js'
import { call, id, member } from './helpers.js'
import type { Node } from './helpers.js'

describe('pera/no-hardcoded-ui-strings', () => {
    const jsxText = (value: string): Node => ({ type: 'JSXText', value })
    const element = (name: string, children: Node[]): Node => ({
        type: 'JSXElement',
        openingElement: {
            type: 'JSXOpeningElement',
            name: { type: 'JSXIdentifier', name },
        },
        children,
    })
    const attribute = (name: string, value: Node): Node => ({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name },
        value,
    })
    const literal = (value: string): Node => ({ type: 'Literal', value })
    const expression: Node = { type: 'JSXExpressionContainer' }
    const template = (...quasis: string[]): Node => ({
        type: 'TemplateLiteral',
        quasis: quasis.map(cooked => ({
            type: 'TemplateElement',
            value: { cooked, raw: cooked },
        })),
        expressions: quasis.slice(1).map(() => id('value')),
    })
    const property = (key: string, value: Node): Node => ({
        type: 'Property',
        computed: false,
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
    const asConst = (inner: Node): Node => ({
        type: 'TSAsExpression',
        expression: inner,
    })
    const constDeclaration = (
        name: string,
        init: Node,
        kind = 'const',
    ): Node => ({
        type: 'VariableDeclaration',
        kind,
        declarations: [{ type: 'VariableDeclarator', id: id(name), init }],
    })
    const exported = (declaration: Node): Node => ({
        type: 'ExportNamedDeclaration',
        declaration,
    })
    const program = (...body: Node[]): Node => ({ type: 'Program', body })

    const lint = (
        visitor: 'JSXElement' | 'JSXAttribute' | 'CallExpression' | 'Program',
        node: Node,
    ) => {
        const report = vi.fn()
        noHardcodedUiStrings.create({ report })[visitor](node)
        return report
    }

    const reportedData = (report: ReturnType<typeof vi.fn>) =>
        report.mock.calls.map(([arg]) => arg.data)

    const mapOf = (value: Node) =>
        program(constDeclaration('LABELS', object(property('label', value))))

    it.each([
        [
            'a text-only <Text>',
            'JSXElement',
            element('Text', [jsxText('Hello there')]),
        ],
        [
            'a PWText sentence',
            'JSXElement',
            element('PWText', [jsxText('Custom Range')]),
        ],
        [
            'a PWText single capitalised word',
            'JSXElement',
            element('PWText', [jsxText('Done')]),
        ],
        [
            'a placeholder prop',
            'JSXAttribute',
            attribute('placeholder', literal('Type here')),
        ],
        [
            'a prop ending in title',
            'JSXAttribute',
            attribute('subtitle', literal('Subtitle copy')),
        ],
        [
            'a toast title object property',
            'CallExpression',
            call(id('showToast'), [
                object(
                    property('title', literal('Copied')),
                    property('body', literal('')),
                    property('type', literal('info')),
                ),
            ]),
        ],
        [
            'a toast message property',
            'CallExpression',
            call(id('showToast'), [
                object(property('message', literal('Something went wrong'))),
            ]),
        ],
        [
            'a successToast argument',
            'CallExpression',
            call(id('successToast'), [literal('Saved')]),
        ],
        [
            'a template toast body with prose',
            'CallExpression',
            call(id('showToast'), [
                object(property('body', template('Sent ', ''))),
            ]),
        ],
        [
            'a literal wrapped in a TS assertion',
            'CallExpression',
            call(id('infoToast'), [asConst(literal('Copied'))]),
        ],
        [
            'a label map value',
            'Program',
            program(
                constDeclaration(
                    'LABELS',
                    object(property('week', literal('Last week'))),
                ),
            ),
        ],
        [
            'an exported array of objects behind as const',
            'Program',
            program(
                exported(
                    constDeclaration(
                        'OPTIONS',
                        asConst(
                            array(
                                object(property('label', literal('Opt-out'))),
                            ),
                        ),
                    ),
                ),
            ),
        ],
        [
            'a deeply nested map value',
            'Program',
            program(
                constDeclaration(
                    'NESTED',
                    object(
                        property(
                            'a',
                            object(
                                property(
                                    'b',
                                    array(literal('Português (Brasil)')),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ],
    ] as const)('reports %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).toHaveBeenCalledOnce()
    })

    it('reports mixed children once, naming the element', () => {
        const report = lint(
            'JSXElement',
            element('AmountRowText', [
                jsxText('Fee: '),
                expression,
                jsxText(' now please'),
            ]),
        )

        expect(reportedData(report)).toEqual([
            { element: 'AmountRowText', text: 'Fee:' },
        ])
    })

    it.each([
        [
            'infoToast',
            call(id('infoToast'), [
                literal('Copied'),
                literal('Address copied to clipboard'),
            ]),
            'infoToast',
        ],
        [
            'a member toast',
            call(member(id('toast'), 'errorToast'), [
                literal('Failed'),
                literal('Try again later'),
            ]),
            'errorToast',
        ],
        [
            'Alert.alert',
            call(member(id('Alert'), 'alert'), [
                literal('Delete account?'),
                literal('This cannot be undone'),
            ]),
            'Alert.alert',
        ],
    ])('reports both prose arguments of %s', (_label, node, callee) => {
        const report = lint('CallExpression', node)

        expect(report).toHaveBeenCalledTimes(2)
        expect(reportedData(report).map(data => data.callee)).toEqual([
            callee,
            callee,
        ])
    })

    it('reports only the prose argument of showError', () => {
        const report = lint(
            'CallExpression',
            call(id('showError'), [
                id('error'),
                literal('Could not add asset'),
            ]),
        )

        expect(reportedData(report)).toEqual([
            { callee: 'showError', text: 'Could not add asset' },
        ])
    })

    it.each([
        ['an expression child', 'JSXElement', element('PWText', [expression])],
        [
            'digits and punctuation',
            'JSXElement',
            element('PWText', [jsxText(' 42 ')]),
        ],
        ['a ticker', 'JSXElement', element('PWText', [jsxText('USDC')])],
        [
            'a trailing ticker after an expression',
            'JSXElement',
            element('PWText', [expression, jsxText(' ALGO')]),
        ],
        [
            'a component not named *Text',
            'JSXElement',
            element('PWView', [jsxText('Hello there')]),
        ],
        ['an expression prop', 'JSXAttribute', attribute('title', expression)],
        [
            'a prop outside the list',
            'JSXAttribute',
            attribute('accessibilityLabel', literal('No')),
        ],
        ['an empty prop', 'JSXAttribute', attribute('body', literal(''))],
        [
            'a translated toast property',
            'CallExpression',
            call(id('showToast'), [
                object(property('title', call(id('t'), [literal('k')]))),
            ]),
        ],
        [
            'an empty toast body',
            'CallExpression',
            call(id('showToast'), [object(property('body', literal('')))]),
        ],
        [
            'raw i18n keys in a toast',
            'CallExpression',
            call(id('errorToast'), [
                literal('common.not_implemented.title'),
                literal('common.not_implemented.body'),
            ]),
        ],
        [
            'an identifier toast argument',
            'CallExpression',
            call(id('showToast'), [id('message')]),
        ],
        [
            'a call that is not a toast',
            'CallExpression',
            call(id('log'), [literal('Hello there')]),
        ],
        [
            'a template without prose',
            'CallExpression',
            call(id('showToast'), [
                object(property('body', template('', 'px ', 'px'))),
            ]),
        ],
        [
            'an i18nKey() map value',
            'Program',
            mapOf(call(id('i18nKey'), [literal('a.b')])),
        ],
        [
            'a route name',
            'Program',
            program(
                constDeclaration(
                    'TABS',
                    array(object(property('name', literal('Home')))),
                ),
            ),
        ],
        [
            'a test id',
            'Program',
            program(
                constDeclaration(
                    'IDS',
                    object(property('testID', literal('Home Button'))),
                ),
            ),
        ],
        [
            'a url property',
            'Program',
            program(
                constDeclaration(
                    'LINKS',
                    object(property('url', literal('https://perawallet.app'))),
                ),
            ),
        ],
        [
            'a let declaration',
            'Program',
            program(
                constDeclaration(
                    'LABELS',
                    object(property('label', literal('Last week'))),
                    'let',
                ),
            ),
        ],
        [
            'a const initialised by a call',
            'Program',
            program(
                constDeclaration(
                    'FROZEN',
                    call(member(id('Object'), 'freeze'), [
                        object(property('label', literal('Last week'))),
                    ]),
                ),
            ),
        ],
        [
            'a spread element',
            'Program',
            program(
                constDeclaration(
                    'LABELS',
                    object({ type: 'SpreadElement', argument: id('base') }),
                ),
            ),
        ],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).not.toHaveBeenCalled()
    })

    it.each([
        ['account_list_item', false],
        ['tab-menu-button', false],
        ['AccountDetails', false],
        ['MainNet', false],
        ['common.not_implemented.title', false],
        ['https://perawallet.app/help center', false],
        ['www.perawallet.app', false],
        ['Custom Range', true],
        ['Done', true],
        ['Opt-out', true],
    ])('treats the map value %s as prose: %s', (value, isReported) => {
        const report = lint('Program', mapOf(literal(value)))

        expect(report.mock.calls.length).toBe(isReported ? 1 : 0)
    })
})
