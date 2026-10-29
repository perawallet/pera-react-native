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
import { noManualUnitConversion } from '../rules/no-manual-unit-conversion.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    template,
    type Node,
} from './helpers.js'

const RULE = 'pera/no-manual-unit-conversion'

const lit = (value: number | string): Node => ({ type: 'Literal', value })
const bigintLit = (digits: string): Node => ({
    type: 'Literal',
    value: BigInt(digits),
    bigint: digits,
    raw: `${digits}n`,
})
const newDecimal = (arg: Node): Node => ({
    type: 'NewExpression',
    callee: id('Decimal'),
    arguments: [arg],
})
const binary = (operator: string, left: Node, right: Node): Node => ({
    type: 'BinaryExpression',
    operator,
    left,
    right,
})
const assign = (operator: string, left: Node, right: Node): Node => ({
    type: 'AssignmentExpression',
    operator,
    left,
    right,
})

type Visitor = 'CallExpression' | 'BinaryExpression' | 'AssignmentExpression'

const lint = (visitor: Visitor, node: Node) => {
    const report = vi.fn()
    noManualUnitConversion.create({ report })[visitor](node)
    return report
}

describe(RULE, () => {
    it.each([
        [
            'Math.pow(10, d)',
            call(member(id('Math'), 'pow'), [lit(10), id('d')]),
        ],
        [
            'Decimal.pow(10, d)',
            call(member(id('Decimal'), 'pow'), [lit(10), id('d')]),
        ],
        [
            'new Decimal(10).pow(d)',
            call(member(newDecimal(lit(10)), 'pow'), [id('d')]),
        ],
    ])('reports powerOfTen for %s', (_label, node) => {
        expect(lint('CallExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'powerOfTen',
        })
    })

    it.each([
        ['10 ** d', binary('**', lit(10), id('d'))],
        ['10n ** d', binary('**', bigintLit('10'), id('d'))],
    ])('reports powerOfTen for %s', (_label, node) => {
        expect(lint('BinaryExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'powerOfTen',
        })
    })

    it.each([
        [
            'x / MICRO_ALGO_DIVISOR',
            'BinaryExpression',
            binary('/', id('x'), id('MICRO_ALGO_DIVISOR')),
            'MICRO_ALGO_DIVISOR',
        ],
        [
            'ALGO_DECIMALS * x',
            'BinaryExpression',
            binary('*', id('ALGO_DECIMALS'), id('x')),
            'ALGO_DECIMALS',
        ],
        [
            'x * constants.ALGO_DECIMALS',
            'BinaryExpression',
            binary('*', id('x'), member(id('constants'), 'ALGO_DECIMALS')),
            'ALGO_DECIMALS',
        ],
        [
            'x /= MICRO_ALGO_DIVISOR',
            'AssignmentExpression',
            assign('/=', id('x'), id('MICRO_ALGO_DIVISOR')),
            'MICRO_ALGO_DIVISOR',
        ],
        [
            'x *= ALGO_DECIMALS',
            'AssignmentExpression',
            assign('*=', id('x'), id('ALGO_DECIMALS')),
            'ALGO_DECIMALS',
        ],
        [
            'amount.div(MICRO_ALGO_DIVISOR)',
            'CallExpression',
            call(member(id('amount'), 'div'), [id('MICRO_ALGO_DIVISOR')]),
            'MICRO_ALGO_DIVISOR',
        ],
        [
            'amount.mul(ALGO_DECIMALS)',
            'CallExpression',
            call(member(id('amount'), 'mul'), [id('ALGO_DECIMALS')]),
            'ALGO_DECIMALS',
        ],
        [
            'amount.times(ALGO_DECIMALS)',
            'CallExpression',
            call(member(id('amount'), 'times'), [id('ALGO_DECIMALS')]),
            'ALGO_DECIMALS',
        ],
        [
            'amount.dividedBy(MICRO_ALGO_DIVISOR)',
            'CallExpression',
            call(member(id('amount'), 'dividedBy'), [id('MICRO_ALGO_DIVISOR')]),
            'MICRO_ALGO_DIVISOR',
        ],
    ] as const)(
        'reports unitConstant for %s',
        (_label, visitor, node, name) => {
            expect(lint(visitor, node)).toHaveBeenCalledExactlyOnceWith({
                node,
                messageId: 'unitConstant',
                data: { name },
            })
        },
    )

    it.each([
        [
            'BigInt(x.toString())',
            call(id('BigInt'), [call(member(id('x'), 'toString'), [])]),
        ],
        [
            'BigInt(String(x))',
            call(id('BigInt'), [call(id('String'), [id('x')])]),
        ],
        ['BigInt(`${x}`)', call(id('BigInt'), [template(['', ''], [id('x')])])],
    ])('reports stringBigInt for %s', (_label, node) => {
        expect(lint('CallExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node,
            messageId: 'stringBigInt',
        })
    })

    it.each([
        [
            'BigInt(d.toFixed(0))',
            'CallExpression',
            call(id('BigInt'), [call(member(id('d'), 'toFixed'), [lit(0)])]),
        ],
        [
            'BigInt(`0x${hex}`)',
            'CallExpression',
            call(id('BigInt'), [template(['0x', ''], [id('hex')])]),
        ],
        ['BigInt(x)', 'CallExpression', call(id('BigInt'), [id('x')])],
        [
            'Math.pow(2, n)',
            'CallExpression',
            call(member(id('Math'), 'pow'), [lit(2), id('n')]),
        ],
        [
            'Decimal.pow(2, n)',
            'CallExpression',
            call(member(id('Decimal'), 'pow'), [lit(2), id('n')]),
        ],
        ['2 ** n', 'BinaryExpression', binary('**', lit(2), id('n'))],
        ['x * y', 'BinaryExpression', binary('*', id('x'), id('y'))],
        [
            'x + MICRO_ALGO_DIVISOR',
            'BinaryExpression',
            binary('+', id('x'), id('MICRO_ALGO_DIVISOR')),
        ],
        [
            'x / ALGO_DECIMALS_LABEL',
            'BinaryExpression',
            binary('/', id('x'), id('ALGO_DECIMALS_LABEL')),
        ],
        [
            'amount.add(ALGO_DECIMALS)',
            'CallExpression',
            call(member(id('amount'), 'add'), [id('ALGO_DECIMALS')]),
        ],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).not.toHaveBeenCalled()
    })

    it('ships at error beside the helpers it exempts, in both configs', () => {
        const root = overridesWith(readOxlintConfig('.oxlintrc.json'), RULE)
        expect(root).toHaveLength(1)
        expect(root[0].rules[RULE]).toBe('error')
        expect(root[0].excludeFiles).toEqual(
            expect.arrayContaining([
                'packages/shared/src/utils/unit-conversion.ts',
                'packages/shared/src/utils/decimal-config.ts',
                '**/__tests__/**',
            ]),
        )

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
