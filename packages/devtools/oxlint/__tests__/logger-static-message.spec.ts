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
import { loggerStaticMessage } from '../rules/logger-static-message.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    template,
    type Node,
} from './helpers.js'

const RULE = 'pera/logger-static-message'

const str = (value: string): Node => ({ type: 'Literal', value })
const plus = (left: Node, right: Node): Node => ({
    type: 'BinaryExpression',
    operator: '+',
    left,
    right,
})
const object = (...keys: string[]): Node => ({
    type: 'ObjectExpression',
    properties: keys.map(key => ({ type: 'Property', key: id(key) })),
})

const lintCall = (node: Node) => {
    const report = vi.fn()
    loggerStaticMessage.create({ report }).CallExpression(node)
    return report
}

describe(RULE, () => {
    const built = template(['x ', ''], [id('y')])

    it.each(['debug', 'info', 'warn', 'error', 'critical'])(
        'reports a template message passed to logger.%s',
        method => {
            const report = lintCall(call(member(id('logger'), method), [built]))

            expect(report).toHaveBeenCalledOnce()
            expect(report).toHaveBeenCalledWith({
                node: built,
                messageId: 'builtMessage',
            })
        },
    )

    it('reports a template message that is followed by a context object', () => {
        const report = lintCall(
            call(member(id('logger'), 'warn'), [built, object('id')]),
        )

        expect(report).toHaveBeenCalledOnce()
    })

    it('reports a message concatenated with a value', () => {
        const message = plus(str('Failed: '), id('id'))

        const report = lintCall(call(member(id('logger'), 'warn'), [message]))

        expect(report).toHaveBeenCalledWith({
            node: message,
            messageId: 'builtMessage',
        })
    })

    it.each([
        [
            'a static message with a context object',
            call(member(id('logger'), 'warn'), [str('static'), object('id')]),
        ],
        [
            'a template without substitutions',
            call(member(id('logger'), 'warn'), [template(['static'], [])]),
        ],
        [
            'a concatenation of literals',
            call(member(id('logger'), 'warn'), [plus(str('a'), str('b'))]),
        ],
        [
            'an error as the message',
            call(member(id('logger'), 'error'), [id('error'), object('step')]),
        ],
        [
            'a conditional message',
            call(member(id('logger'), 'error'), [
                {
                    type: 'ConditionalExpression',
                    test: id('ok'),
                    consequent: id('error'),
                    alternate: call(id('String'), [id('error')]),
                },
            ]),
        ],
        ['console.warn', call(member(id('console'), 'warn'), [built])],
        [
            'a warn on another object',
            call(member(member(id('utils'), 'log'), 'warn'), [built]),
        ],
        [
            'a computed method',
            call(
                {
                    type: 'MemberExpression',
                    computed: true,
                    object: id('logger'),
                    property: id('level'),
                },
                [built],
            ),
        ],
        ['a non-logger method', call(member(id('logger'), 'child'), [built])],
        ['a call without arguments', call(member(id('logger'), 'warn'), [])],
    ])('allows %s', (_label, node) => {
        expect(lintCall(node)).not.toHaveBeenCalled()
    })

    it('ships at error for packages, extensions and the browser app, and for mobile', () => {
        const root = overridesWith(readOxlintConfig('.oxlintrc.json'), RULE)
        expect(root).toHaveLength(1)
        expect(root[0].rules[RULE]).toBe('error')
        expect(root[0].files).toEqual([
            'packages/*/src/**',
            'extensions/*/src/**',
            'apps/browser/src/**',
        ])
        expect(root[0].excludeFiles).toEqual(
            expect.arrayContaining(['**/__tests__/**', '**/*.spec.{ts,tsx}']),
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
