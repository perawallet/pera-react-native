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
import { queryPendingGated } from '../rules/query-pending-gated.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    withParents,
    type Node,
} from './helpers.js'

const RULE = 'pera/query-pending-gated'

const obj = (...properties: Node[]): Node => ({
    type: 'ObjectExpression',
    properties,
})
const prop = (
    key: string,
    value: Node,
    { shorthand = false }: { shorthand?: boolean } = {},
): Node => ({
    type: 'Property',
    computed: false,
    shorthand,
    key: id(key),
    value,
})
const lit = (value: unknown): Node => ({ type: 'Literal', value })
const logical = (operator: string, left: Node, right: Node): Node => ({
    type: 'LogicalExpression',
    operator,
    left,
    right,
})
const cond = (test: Node, consequent: Node, alternate: Node): Node => ({
    type: 'ConditionalExpression',
    test,
    consequent,
    alternate,
})
const not = (argument: Node): Node => ({
    type: 'UnaryExpression',
    operator: '!',
    argument,
})
const strictEquals = (left: Node, right: Node): Node => ({
    type: 'BinaryExpression',
    operator: '===',
    left,
    right,
})
const ifReturn = (test: Node, consequent: Node): Node => ({
    type: 'IfStatement',
    test,
    consequent,
    alternate: null,
})
const block = (...body: Node[]): Node => ({ type: 'BlockStatement', body })
const declare = (target: Node, init: Node): Node => ({
    type: 'VariableDeclaration',
    declarations: [{ type: 'VariableDeclarator', id: target, init }],
})
const pattern = (...properties: Node[]): Node => ({
    type: 'ObjectPattern',
    properties,
})
const arrow = (statements: Node[]): Node => ({
    type: 'ArrowFunctionExpression',
    params: [],
    body: { type: 'BlockStatement', body: statements },
})
const ret = (argument: Node): Node => ({ type: 'ReturnStatement', argument })
const array = (...elements: Node[]): Node => ({
    type: 'ArrayExpression',
    elements,
})
const pendingOf = (name = 'query'): Node => member(id(name), 'isPending')
const result = (...properties: Node[]): Node => ret(obj(...properties))

describe(RULE, () => {
    const queryCall = (hook: string, options: Node[]): Node =>
        call(id(hook), [obj(...options)])
    const enabled = (value: Node): Node => prop('enabled', value)

    const lint = (statements: Node[], target: Node) => {
        const report = vi.fn()
        withParents(arrow(statements))
        queryPendingGated.create({ report }).CallExpression(target)
        return report
    }
    // `const query = useQuery({ enabled: gate }); return { isPending: read }`
    const readOf = (
        gate: Node,
        read: Node,
        { hook = 'useQuery' }: { hook?: string } = {},
    ) => {
        const target = queryCall(hook, [enabled(gate)])
        return lint(
            [declare(id('query'), target), result(prop('isPending', read))],
            target,
        )
    }

    describe('flagged', () => {
        it.each(['useQuery', 'useInfiniteQuery'])(
            'reports a raw isPending read of a %s gated by a name',
            hook => {
                const report = readOf(id('isEnabled'), pendingOf(), { hook })

                expect(report).toHaveBeenCalledExactlyOnceWith(
                    expect.objectContaining({
                        messageId: 'ungated',
                        data: { hook, gate: 'isEnabled' },
                    }),
                )
            },
        )

        it('reports a destructured isPending returned as shorthand', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])

            const report = lint(
                [
                    declare(
                        pattern(
                            prop('isPending', id('isPending'), {
                                shorthand: true,
                            }),
                        ),
                        target,
                    ),
                    result(
                        prop('isPending', id('isPending'), { shorthand: true }),
                    ),
                ],
                target,
            )

            expect(report).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    data: { hook: 'useQuery', gate: 'isEnabled' },
                }),
            )
        })

        it('reports a renamed destructured isPending', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])

            const report = lint(
                [
                    declare(
                        pattern(prop('isPending', id('isFeePending'))),
                        target,
                    ),
                    result(prop('isPending', id('isFeePending'))),
                ],
                target,
            )

            expect(report).toHaveBeenCalledTimes(1)
        })

        it('reports a later destructure of the query', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])

            const report = lint(
                [
                    declare(id('query'), target),
                    declare(
                        pattern(
                            prop('isPending', id('isPending'), {
                                shorthand: true,
                            }),
                        ),
                        id('query'),
                    ),
                    result(prop('isPending', id('isPending'))),
                ],
                target,
            )

            expect(report).toHaveBeenCalledTimes(1)
        })

        it('reports a guard that leaves out part of the gate', () => {
            const gate = logical(
                '&&',
                not(not(id('address'))),
                not(id('isOff')),
            )

            const report = readOf(
                gate,
                cond(id('isOff'), lit(false), pendingOf()),
            )

            expect(report).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    data: { hook: 'useQuery', gate: 'address, isOff' },
                }),
            )
        })

        it('does not accept isPaused alone as the fix', () => {
            const report = readOf(
                id('isEnabled'),
                logical(
                    '&&',
                    not(member(id('query'), 'isPaused')),
                    pendingOf(),
                ),
            )

            expect(report).toHaveBeenCalledTimes(1)
        })

        it.each([
            [
                '!address || query.isPending, true while disabled',
                () => logical('||', not(id('address')), pendingOf()),
            ],
            [
                "fetchStatus === 'idle' && query.isPending, true only while disabled",
                () =>
                    logical(
                        '&&',
                        strictEquals(
                            member(id('query'), 'fetchStatus'),
                            lit('idle'),
                        ),
                        pendingOf(),
                    ),
            ],
            [
                '!address && query.isPending, the gate inverted',
                () => logical('&&', not(id('address')), pendingOf()),
            ],
            [
                'address ? false : query.isPending, the branches swapped',
                () => cond(id('address'), lit(false), pendingOf()),
            ],
            [
                '!query.isFetching && query.isPending',
                () =>
                    logical(
                        '&&',
                        not(member(id('query'), 'isFetching')),
                        pendingOf(),
                    ),
            ],
        ])('reports %s', (_label, read) => {
            expect(
                readOf(not(not(id('address'))), read()),
            ).toHaveBeenCalledTimes(1)
        })

        it('reports a read guarded by an && outside the value it feeds', () => {
            const read = logical(
                '&&',
                id('address'),
                call(id('track'), [pendingOf()]),
            )

            expect(readOf(not(not(id('address'))), read)).toHaveBeenCalledTimes(
                1,
            )
        })

        it('reports a read before the early return', () => {
            const target = queryCall('useQuery', [
                enabled(not(not(id('address')))),
            ])

            const report = lint(
                [
                    declare(id('query'), target),
                    declare(id('wasPending'), pendingOf()),
                    ifReturn(not(id('address')), ret(lit(false))),
                    result(prop('isPending', id('wasPending'))),
                ],
                target,
            )

            expect(report).toHaveBeenCalledTimes(1)
        })

        it('does not take an early return that has an else branch', () => {
            const target = queryCall('useQuery', [
                enabled(not(not(id('address')))),
            ])

            const report = lint(
                [
                    declare(id('query'), target),
                    {
                        ...ifReturn(not(id('address')), ret(lit(false))),
                        alternate: block(),
                    },
                    result(prop('isPending', pendingOf())),
                ],
                target,
            )

            expect(report).toHaveBeenCalledTimes(1)
        })

        it('reports a raw read inside a useMemo callback', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])
            const memo = call(id('useMemo'), [
                arrow([result(prop('isPending', pendingOf()))]),
                array(),
            ])

            const report = lint(
                [declare(id('query'), target), ret(memo)],
                target,
            )

            expect(report).toHaveBeenCalledTimes(1)
        })
    })

    describe('allowed', () => {
        it.each([
            [
                'a satisfies-wrapped guarded read',
                () =>
                    logical('&&', id('isEnabled'), {
                        type: 'TSSatisfiesExpression',
                        expression: pendingOf(),
                    }),
            ],
            [
                'the ticket fix: isEnabled ? query.isPending : false',
                () => cond(id('isEnabled'), pendingOf(), lit(false)),
            ],
            [
                'isEnabled && query.isPending',
                () => logical('&&', id('isEnabled'), pendingOf()),
            ],
            [
                'a guard that is isFetching',
                () =>
                    logical(
                        '&&',
                        pendingOf(),
                        member(id('query'), 'isFetching'),
                    ),
            ],
            [
                'a guard that reads fetchStatus',
                () =>
                    logical(
                        '&&',
                        strictEquals(
                            member(id('query'), 'fetchStatus'),
                            lit('fetching'),
                        ),
                        pendingOf(),
                    ),
            ],
        ])('allows %s', (_label, read) => {
            expect(readOf(id('isEnabled'), read())).not.toHaveBeenCalled()
        })

        it.each([
            [
                'the read on the left of the &&',
                () => logical('&&', pendingOf(), id('address')),
            ],
            [
                '!!address against a Boolean(address) gate',
                () => logical('&&', not(not(id('address'))), pendingOf()),
            ],
            [
                "fetchStatus !== 'idle'",
                () =>
                    logical(
                        '&&',
                        {
                            ...strictEquals(
                                member(id('query'), 'fetchStatus'),
                                lit('idle'),
                            ),
                            operator: '!==',
                        },
                        pendingOf(),
                    ),
            ],
            [
                'a negated test with the read in the alternate',
                () => cond(not(id('address')), lit(false), pendingOf()),
            ],
        ])('allows %s', (_label, read) => {
            const gate = call(id('Boolean'), [id('address')])

            expect(readOf(gate, read())).not.toHaveBeenCalled()
        })

        it.each([
            ['a return', ret(lit(false))],
            ['a block ending in a throw', block({ type: 'ThrowStatement' })],
        ])('allows a read after an early exit by %s', (_label, exit) => {
            const target = queryCall('useQuery', [
                enabled(not(not(id('address')))),
            ])

            const report = lint(
                [
                    declare(id('query'), target),
                    ifReturn(not(id('address')), exit),
                    result(prop('isPending', pendingOf())),
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it('allows early exits that together cover the gate', () => {
            const gate = logical('&&', id('hasAddress'), not(id('isOff')))
            const target = queryCall('useQuery', [enabled(gate)])

            const report = lint(
                [
                    declare(id('query'), target),
                    ifReturn(
                        logical('||', not(id('hasAddress')), id('isOff')),
                        ret(lit(false)),
                    ),
                    result(prop('isPending', pendingOf())),
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it('allows a read inside the consequent of an if on the gate', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])

            const report = lint(
                [
                    declare(id('query'), target),
                    {
                        ...ifReturn(
                            id('isEnabled'),
                            block(result(prop('isPending', pendingOf()))),
                        ),
                    },
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it('allows a pending state of its own ORed with the guarded read', () => {
            const read = logical(
                '||',
                logical('&&', id('hasAddresses'), id('isAwaitingMinFee')),
                logical('&&', id('isEnabled'), pendingOf()),
            )

            expect(readOf(id('isEnabled'), read)).not.toHaveBeenCalled()
        })

        it('allows gate names spread across nested combinators', () => {
            const gate = logical(
                '&&',
                not(not(id('address'))),
                not(id('isOff')),
            )
            const read = cond(
                logical('&&', not(not(id('address'))), not(id('isOff'))),
                pendingOf(),
                lit(false),
            )

            expect(readOf(gate, read)).not.toHaveBeenCalled()
        })

        it('does not count a member property as a gate name', () => {
            const gate = not(member(id('parsedConfig'), 'error'))
            const read = logical(
                '&&',
                not(member(id('parsedConfig'), 'error')),
                pendingOf(),
            )

            expect(readOf(gate, read)).not.toHaveBeenCalled()
        })

        it('does not count a callee as a gate name', () => {
            const gate = call(id('Boolean'), [id('address')])
            const read = logical('&&', not(not(id('address'))), pendingOf())

            expect(readOf(gate, read)).not.toHaveBeenCalled()
        })

        it('allows the read as an element of a hook deps array', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])
            const memo = call(id('useMemo'), [
                arrow([result(prop('data', member(id('query'), 'data')))]),
                array(pendingOf()),
            ])

            const report = lint(
                [declare(id('query'), target), ret(memo)],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it.each([
            ['a true literal', lit(true)],
            ['a false literal', lit(false)],
        ])('ignores enabled as %s', (_label, gate) => {
            expect(readOf(gate, pendingOf())).not.toHaveBeenCalled()
        })

        it('ignores a query with no enabled', () => {
            const target = queryCall('useQuery', [])

            const report = lint(
                [
                    declare(id('query'), target),
                    result(prop('isPending', pendingOf())),
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it('ignores isLoading and data reads', () => {
            const target = queryCall('useQuery', [enabled(id('isEnabled'))])

            const report = lint(
                [
                    declare(id('query'), target),
                    result(
                        prop('isLoading', member(id('query'), 'isLoading')),
                        prop('data', member(id('query'), 'data')),
                    ),
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })

        it('ignores a gated query that is returned raw', () => {
            const target = queryCall('useQuery', [enabled(id('x'))])

            const report = lint([ret(target)], target)

            expect(report).not.toHaveBeenCalled()
        })

        it('ignores other callees', () => {
            const target = queryCall('useMutation', [enabled(id('x'))])

            const report = lint(
                [
                    declare(id('query'), target),
                    result(prop('isPending', pendingOf())),
                ],
                target,
            )

            expect(report).not.toHaveBeenCalled()
        })
    })

    describe('config', () => {
        const TEST_EXCLUDES = ['**/__tests__/**', '**/*.spec.{ts,tsx}']

        it('ships at error in exactly one override of the root config', () => {
            const overrides = overridesWith(
                readOxlintConfig('.oxlintrc.json'),
                RULE,
            )

            expect(overrides).toHaveLength(1)
            expect(overrides[0].rules[RULE]).toBe('error')
            expect(overrides[0].files).toEqual([
                'packages/*/src/**',
                'extensions/*/src/**',
                'apps/browser/src/**',
            ])
            expect(overrides[0].excludeFiles).toEqual(
                expect.arrayContaining(TEST_EXCLUDES),
            )
        })

        it('ships at error in exactly one override of the mobile config', () => {
            const overrides = overridesWith(
                readOxlintConfig('apps/mobile/.oxlintrc.json'),
                RULE,
            )

            expect(overrides).toHaveLength(1)
            expect(overrides[0].rules[RULE]).toBe('error')
            expect(overrides[0].files).toEqual(['src/**'])
            expect(overrides[0].excludeFiles).toEqual(
                expect.arrayContaining([
                    'src/**/__tests__/**',
                    'src/**/*.spec.{ts,tsx}',
                ]),
            )
        })
    })
})
