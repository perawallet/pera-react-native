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

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { monotonicLockoutClock } from '../rules/monotonic-lockout-clock.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

const RULE = 'pera/monotonic-lockout-clock'

const dateNow = (): Node => call(member(id('Date'), 'now'), [])
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
const str = (value: string): Node => ({ type: 'Literal', value })
const template = (expressions: Node[]): Node => ({
    type: 'TemplateLiteral',
    quasis: [],
    expressions,
})

type Visitor = 'BinaryExpression' | 'AssignmentExpression'

const lint = (visitor: Visitor, node: Node) => {
    const report = vi.fn()
    monotonicLockoutClock.create({ report })[visitor](node)
    return report
}

// `const <name> = Date.now()` followed by one read of `<name>` as the operand
// of `parent`, which the mocked scope manager hands back as a reference.
const lintConstAlias = (kind: string, parentOf: (ref: Node) => Node) => {
    const report = vi.fn()
    const reference = id('now')
    const parent = parentOf(reference)
    reference.parent = parent
    const declarator = {
        type: 'VariableDeclarator',
        id: id('now'),
        init: dateNow(),
    }
    const getDeclaredVariables = vi.fn(() => [
        { references: [{ identifier: reference, isRead: () => true }] },
    ])
    monotonicLockoutClock
        .create({
            report,
            sourceCode: { getDeclaredVariables },
        })
        .VariableDeclaration({
            type: 'VariableDeclaration',
            kind,
            declarations: [declarator],
        })
    return { report, reference, getDeclaredVariables }
}

describe(RULE, () => {
    it.each([
        ['Date.now() < deadline', binary('<', dateNow(), id('deadline'))],
        ['deadline - Date.now()', binary('-', id('deadline'), dateNow())],
        ['Date.now() + ms', binary('+', dateNow(), id('ms'))],
        ['start >= Date.now()', binary('>=', id('start'), dateNow())],
        ['x === Date.now()', binary('===', id('x'), dateNow())],
    ])('reports %s', (_label, node) => {
        const operand = [node.left, node.right].find(
            side => (side as Node).type === 'CallExpression',
        )
        expect(lint('BinaryExpression', node)).toHaveBeenCalledExactlyOnceWith({
            node: operand,
            messageId: 'wallClock',
        })
    })

    it('reports a compound assignment from Date.now()', () => {
        const node = assign('-=', id('elapsed'), dateNow())
        expect(
            lint('AssignmentExpression', node),
        ).toHaveBeenCalledExactlyOnceWith({
            node: node.right,
            messageId: 'wallClock',
        })
    })

    it('reports a read of a const bound to Date.now() used in arithmetic', () => {
        const { report, reference } = lintConstAlias('const', ref =>
            binary('-', ref, id('last')),
        )
        expect(report).toHaveBeenCalledExactlyOnceWith({
            node: reference,
            messageId: 'wallClock',
        })
    })

    it.each([
        [
            "'at ' + Date.now()",
            'BinaryExpression',
            binary('+', str('at '), dateNow()),
        ],
        [
            'Date.now() + " ms"',
            'BinaryExpression',
            binary('+', dateNow(), str(' ms')),
        ],
        [
            '`${Date.now()}` + x',
            'BinaryExpression',
            binary('+', template([dateNow()]), id('x')),
        ],
        [
            'performance.now() - start',
            'BinaryExpression',
            binary(
                '-',
                call(member(id('performance'), 'now'), []),
                id('start'),
            ),
        ],
        [
            'x = Date.now()',
            'AssignmentExpression',
            assign('=', id('x'), dateNow()),
        ],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).not.toHaveBeenCalled()
    })

    it('allows a const bound to Date.now() that is only recorded', () => {
        const { report } = lintConstAlias('const', ref =>
            call(id('record'), [ref]),
        )
        expect(report).not.toHaveBeenCalled()
    })

    it('allows a const bound to Date.now() read in string concatenation', () => {
        const { report } = lintConstAlias('const', ref =>
            binary('+', str('at '), ref),
        )
        expect(report).not.toHaveBeenCalled()
    })

    it('follows only const bindings', () => {
        const { report, getDeclaredVariables } = lintConstAlias('let', ref =>
            binary('-', ref, id('x')),
        )
        expect(getDeclaredVariables).not.toHaveBeenCalled()
        expect(report).not.toHaveBeenCalled()
    })

    it('is an error in the security package, the keystore vault and the mobile vault module', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')

        expect(
            overridesWith(root, RULE).map(o => [o.files, o.rules[RULE]]),
        ).toEqual([
            [
                [
                    'packages/security/src/**',
                    'extensions/keystore-chrome/src/vault/**',
                ],
                'error',
            ],
        ])
        expect(
            overridesWith(mobile, RULE).map(o => [o.files, o.rules[RULE]]),
        ).toEqual([[['src/modules/vault/**'], 'error']])
    })

    it('points at directories that exist', () => {
        const repo = join(__dirname, '../../../..')
        for (const dir of [
            'packages/security/src',
            'extensions/keystore-chrome/src/vault',
            'apps/mobile/src/modules/vault',
        ]) {
            expect(existsSync(join(repo, dir))).toBe(true)
        }
    })
})
