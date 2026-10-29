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
import { noDisplayStringIdentity } from '../rules/no-display-string-identity.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

const RULE = 'pera/no-display-string-identity'

const lit = (value: number | string): Node => ({ type: 'Literal', value })
const regex = (pattern: string, flags = ''): Node => ({
    type: 'Literal',
    value: null,
    regex: { pattern, flags },
})
const template = (raw: string): Node => ({
    type: 'TemplateLiteral',
    quasis: [{ type: 'TemplateElement', value: { raw } }],
    expressions: [],
})
const binary = (operator: string, left: Node, right: Node): Node => ({
    type: 'BinaryExpression',
    operator,
    left,
    right,
})
const logical = (operator: string, left: Node, right: Node): Node => ({
    type: 'LogicalExpression',
    operator,
    left,
    right,
})
const chain = (expression: Node): Node => ({
    type: 'ChainExpression',
    expression,
})
const optionalMember = (object: Node, property: string): Node => ({
    ...member(object, property),
    optional: true,
})
const computedMember = (object: Node, property: Node): Node => ({
    type: 'MemberExpression',
    object,
    property,
    computed: true,
})
const newExpr = (callee: Node, args: Node[]): Node => ({
    type: 'NewExpression',
    callee,
    arguments: args,
})
const isAlgoAssetName = (arg: Node): Node => call(id('isAlgoAssetName'), [arg])

type Visitor =
    | 'CallExpression'
    | 'NewExpression'
    | 'Literal'
    | 'BinaryExpression'

const lint = (visitor: Visitor, node: Node) => {
    const report = vi.fn()
    noDisplayStringIdentity.create({ report })[visitor](node)
    return report
}

describe(RULE, () => {
    it.each([
        [
            'isAlgoAssetName(token.symbol)',
            isAlgoAssetName(member(id('token'), 'symbol')),
            'symbol',
        ],
        [
            'isAlgoAssetName(asset.unitName)',
            isAlgoAssetName(member(id('asset'), 'unitName')),
            'unitName',
        ],
        [
            'isAlgoAssetName(asset.name)',
            isAlgoAssetName(member(id('asset'), 'name')),
            'name',
        ],
        [
            'isAlgoAssetName(token?.symbol)',
            isAlgoAssetName(chain(optionalMember(id('token'), 'symbol'))),
            'symbol',
        ],
        [
            "isAlgoAssetName(token.symbol ?? '')",
            isAlgoAssetName(
                logical('??', member(id('token'), 'symbol'), lit('')),
            ),
            'symbol',
        ],
        [
            'isAlgoAssetName(token.id || token.symbol)',
            isAlgoAssetName(
                logical(
                    '||',
                    member(id('token'), 'id'),
                    member(id('token'), 'symbol'),
                ),
            ),
            'symbol',
        ],
        [
            'shared.isAlgoAssetName(token.symbol)',
            call(member(id('shared'), 'isAlgoAssetName'), [
                member(id('token'), 'symbol'),
            ]),
            'symbol',
        ],
        [
            'isAlgoAssetName(unitName)',
            isAlgoAssetName(id('unitName')),
            'unitName',
        ],
        [
            'isAlgoAssetName(asset.unitName?.toUpperCase())',
            isAlgoAssetName(
                chain(
                    call(
                        optionalMember(
                            member(id('asset'), 'unitName'),
                            'toUpperCase',
                        ),
                        [],
                    ),
                ),
            ),
            'unitName',
        ],
        [
            "isAlgoAssetName(token['symbol'])",
            isAlgoAssetName(computedMember(id('token'), lit('symbol'))),
            'symbol',
        ],
    ])('reports displayStringIdentity for %s', (_label, node, name) => {
        expect(lint('CallExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'displayStringIdentity',
            data: { name },
        })
    })

    it.each([
        [
            "asset.unitName === 'ALGO'",
            binary('===', member(id('asset'), 'unitName'), lit('ALGO')),
            'unitName',
        ],
        [
            'ALGO_ASSET_NAME !== token.symbol',
            binary('!==', id('ALGO_ASSET_NAME'), member(id('token'), 'symbol')),
            'symbol',
        ],
        [
            'asset.name.toUpperCase() === ALGO',
            binary(
                '===',
                call(member(member(id('asset'), 'name'), 'toUpperCase'), []),
                lit('ALGO'),
            ),
            'name',
        ],
        [
            "x.unitName.toLowerCase() === 'algo'",
            binary(
                '===',
                call(member(member(id('x'), 'unitName'), 'toLowerCase'), []),
                lit('algo'),
            ),
            'unitName',
        ],
        [
            "token['symbol'] === 'ALGO'",
            binary(
                '===',
                computedMember(id('token'), lit('symbol')),
                lit('ALGO'),
            ),
            'symbol',
        ],
        [
            'token.symbol!.toLowerCase() === ALGO_ASSET_NAME.toLowerCase()',
            binary(
                '===',
                call(
                    member(
                        {
                            type: 'TSNonNullExpression',
                            expression: member(id('token'), 'symbol'),
                        },
                        'toLowerCase',
                    ),
                    [],
                ),
                call(member(id('ALGO_ASSET_NAME'), 'toLowerCase'), []),
            ),
            'symbol',
        ],
        [
            'asset.name === shared.ALGO_ASSET_NAME',
            binary(
                '===',
                member(id('asset'), 'name'),
                member(id('shared'), 'ALGO_ASSET_NAME'),
            ),
            'name',
        ],
    ])('reports displayStringIdentity for %s', (_label, node, name) => {
        expect(lint('BinaryExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'displayStringIdentity',
            data: { name },
        })
    })

    it.each([
        ['/^[a-zA-Z0-9]{58}$/', regex('^[a-zA-Z0-9]{58}$')],
        ['/^[A-Z2-7]{58}$/', regex('^[A-Z2-7]{58}$')],
    ])('reports addressShape for the regex literal %s', (_label, node) => {
        expect(lint('Literal', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'addressShape',
        })
    })

    it.each([
        [
            "new RegExp('^[a-zA-Z0-9]{58}$')",
            'NewExpression' as const,
            newExpr(id('RegExp'), [lit('^[a-zA-Z0-9]{58}$')]),
        ],
        [
            "RegExp('^[A-Z2-7]{58}$')",
            'CallExpression' as const,
            call(id('RegExp'), [lit('^[A-Z2-7]{58}$')]),
        ],
        [
            'new RegExp(`^[A-Z2-7]{58}$`)',
            'NewExpression' as const,
            newExpr(id('RegExp'), [template('^[A-Z2-7]{58}$')]),
        ],
    ])('reports addressShape for %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'addressShape',
        })
    })

    it.each([
        [
            'address.length !== 58',
            binary('!==', member(id('address'), 'length'), lit(58)),
        ],
        [
            '58 === address.length',
            binary('===', lit(58), member(id('address'), 'length')),
        ],
        [
            'address?.length === 58',
            binary(
                '===',
                chain(optionalMember(id('address'), 'length')),
                lit(58),
            ),
        ],
    ])('reports addressShape for %s', (_label, node) => {
        expect(lint('BinaryExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'addressShape',
        })
    })

    it.each([
        [
            'isAlgoAssetName(token.id)',
            'CallExpression' as const,
            isAlgoAssetName(member(id('token'), 'id')),
        ],
        [
            'isAlgoAssetName(preference.preferredCurrency)',
            'CallExpression' as const,
            isAlgoAssetName(member(id('preference'), 'preferredCurrency')),
        ],
        [
            'isAlgoAssetName(code)',
            'CallExpression' as const,
            isAlgoAssetName(id('code')),
        ],
        [
            "token.symbol === 'USDC'",
            'BinaryExpression' as const,
            binary('===', member(id('token'), 'symbol'), lit('USDC')),
        ],
        [
            'token.symbol.toUpperCase() === USDC',
            'BinaryExpression' as const,
            binary(
                '===',
                call(member(member(id('token'), 'symbol'), 'toUpperCase'), []),
                lit('USDC'),
            ),
        ],
        [
            'isAlgoAssetName(token.id.toUpperCase())',
            'CallExpression' as const,
            isAlgoAssetName(
                call(member(member(id('token'), 'id'), 'toUpperCase'), []),
            ),
        ],
        [
            "token[key] === 'ALGO'",
            'BinaryExpression' as const,
            binary('===', computedMember(id('token'), id('key')), lit('ALGO')),
        ],
        [
            "asset.id === '0'",
            'BinaryExpression' as const,
            binary('===', member(id('asset'), 'id'), lit('0')),
        ],
        [
            '/[A-Z2-7]{58}/g (scanner)',
            'Literal' as const,
            regex('[A-Z2-7]{58}', 'g'),
        ],
        [
            'an error-parsing pattern',
            'Literal' as const,
            regex('unavailable (Account|Asset|App) ([A-Z2-7]{58}|\\d+)'),
        ],
        ['/^0x[0-9a-f]{40}$/', 'Literal' as const, regex('^0x[0-9a-f]{40}$')],
        ['/^[A-Z2-7]{52}$/', 'Literal' as const, regex('^[A-Z2-7]{52}$')],
        [
            'new RegExp(pattern)',
            'NewExpression' as const,
            newExpr(id('RegExp'), [id('pattern')]),
        ],
        [
            'address.length > 58',
            'BinaryExpression' as const,
            binary('>', member(id('address'), 'length'), lit(58)),
        ],
        [
            'items.length === 0',
            'BinaryExpression' as const,
            binary('===', member(id('items'), 'length'), lit(0)),
        ],
    ])('allows %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).not.toHaveBeenCalled()
    })

    it('ships at error beside the codec it exempts, in both configs', () => {
        const root = overridesWith(readOxlintConfig('.oxlintrc.json'), RULE)
        expect(root).toHaveLength(1)
        expect(root[0].rules[RULE]).toBe('error')
        expect(root[0].files).toEqual([
            'packages/*/src/**',
            'extensions/*/src/**',
            'apps/browser/src/**',
        ])
        expect(root[0].excludeFiles).toEqual([
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/test-utils/**',
            '**/__integration__/**',
            '**/*.spec.{ts,tsx}',
            '**/*.test.{ts,tsx}',
            'packages/site-safety/src/addresses.ts',
        ])

        const mobile = overridesWith(
            readOxlintConfig('apps/mobile/.oxlintrc.json'),
            RULE,
        )
        expect(mobile).toHaveLength(1)
        expect(mobile[0].rules[RULE]).toBe('error')
        expect(mobile[0].files).toEqual(['src/**'])
        expect(mobile[0].excludeFiles).toContain('src/**/__tests__/**')
    })
})
