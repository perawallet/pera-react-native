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
import { noPlatformOsWeb } from '../rules/no-platform-os-web.js'
import { id, member, type Node } from './helpers.js'

describe('pera/no-platform-os-web', () => {
    const platformOs = member(id('Platform'), 'OS')
    const literal = (value: string): Node => ({ type: 'Literal', value })
    const compare = (operator: string, left: Node, right: Node): Node => ({
        type: 'BinaryExpression',
        operator,
        left,
        right,
    })
    const switchOn = (discriminant: Node, ...tests: Node[]): Node => ({
        type: 'SwitchStatement',
        discriminant,
        cases: tests.map(test => ({ type: 'SwitchCase', test })),
    })

    const lintWeb = (node: Node) => {
        const report = vi.fn()
        const visitors = noPlatformOsWeb.create({ report })
        const visit = visitors[node.type as keyof typeof visitors]
        visit(node)
        return report
    }

    it.each([
        ['=== web', compare('===', platformOs, literal('web'))],
        ['!== web', compare('!==', platformOs, literal('web'))],
        ['== web', compare('==', platformOs, literal('web'))],
        ['a reversed comparison', compare('===', literal('web'), platformOs)],
        [
            "a switch with case 'web'",
            switchOn(platformOs, literal('ios'), literal('web')),
        ],
    ])('reports %s', (_label, node) => {
        expect(lintWeb(node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'web' }),
        )
    })

    it.each([
        ['=== ios', compare('===', platformOs, literal('ios'))],
        [
            'another object’s OS',
            compare('===', member(id('device'), 'OS'), literal('web')),
        ],
        ['a non-equality operator', compare('+', platformOs, literal('web'))],
        [
            'a switch without a web case',
            switchOn(platformOs, literal('ios'), literal('android')),
        ],
        ['a switch on something else', switchOn(id('surface'), literal('web'))],
    ])('allows %s', (_label, node) => {
        expect(lintWeb(node)).not.toHaveBeenCalled()
    })
})
