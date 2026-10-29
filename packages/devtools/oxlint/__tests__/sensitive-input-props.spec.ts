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
import { sensitiveInputProps } from '../rules/sensitive-input-props.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

describe('pera/sensitive-input-props', () => {
    const opening = (attributes: Node[]): Node => ({
        type: 'JSXOpeningElement',
        name: { type: 'JSXIdentifier', name: 'PWInput' },
        attributes,
    })
    const attr = (name: string, value: Node | null = null): Node => ({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name },
        value,
    })
    const container = (expression: Node): Node => ({
        type: 'JSXExpressionContainer',
        expression,
    })
    const spread = (argument: Node): Node => ({
        type: 'JSXSpreadAttribute',
        argument,
    })
    const literal = (value: boolean): Node => ({ type: 'Literal', value })
    const parenthesized = (expression: Node): Node => ({
        type: 'ParenthesizedExpression',
        expression,
    })
    const conditional = (consequent: Node, alternate: Node): Node => ({
        type: 'ConditionalExpression',
        test: id('isSensitive'),
        consequent,
        alternate,
    })
    const logical = (left: Node, right: Node): Node => ({
        type: 'LogicalExpression',
        operator: '&&',
        left,
        right,
    })

    const secure = attr('secureTextEntry')
    const helperCall = call(id('getSensitiveInputProps'), [])

    const lint = (attributes: Node[]) => {
        const report = vi.fn()
        sensitiveInputProps
            .create({ report })
            .JSXOpeningElement(opening(attributes))
        return report
    }

    it.each([
        ['bare secureTextEntry', [secure]],
        [
            'secureTextEntry={true}',
            [attr('secureTextEntry', container(literal(true)))],
        ],
        [
            'secureTextEntry={isHidden}',
            [attr('secureTextEntry', container(id('isHidden')))],
        ],
        [
            'secureTextEntry isSensitive={false}',
            [secure, attr('isSensitive', container(literal(false)))],
        ],
        ['secureTextEntry {...props}', [secure, spread(id('props'))]],
        [
            'secureTextEntry {...getOtherProps()}',
            [secure, spread(call(id('getOtherProps'), []))],
        ],
    ])('reports %s on the secureTextEntry attribute', (_label, attributes) => {
        const report = lint(attributes)

        expect(report).toHaveBeenCalledOnce()
        expect(report).toHaveBeenCalledWith({
            node: attributes[0],
            messageId: 'missing',
        })
    })

    it.each([
        ['secureTextEntry isSensitive', [secure, attr('isSensitive')]],
        [
            'secureTextEntry isSensitive={isSecret}',
            [secure, attr('isSensitive', container(id('isSecret')))],
        ],
        [
            'secureTextEntry {...getSensitiveInputProps()}',
            [secure, spread(helperCall)],
        ],
        [
            'secureTextEntry {...inputs.getSensitiveInputProps()}',
            [
                secure,
                spread(
                    call(member(id('inputs'), 'getSensitiveInputProps'), []),
                ),
            ],
        ],
        [
            'the PWInput conditional spread',
            [
                attr('secureTextEntry', container(id('x'))),
                spread(
                    conditional(
                        call(id('getSensitiveInputProps'), [
                            { type: 'ObjectExpression', properties: [] },
                        ]),
                        id('undefined'),
                    ),
                ),
            ],
        ],
        [
            'the PWInput conditional spread in parentheses',
            [
                attr('secureTextEntry', container(id('x'))),
                spread(parenthesized(conditional(helperCall, id('undefined')))),
            ],
        ],
        [
            'secureTextEntry {...(isSensitive && getSensitiveInputProps())}',
            [
                secure,
                spread(parenthesized(logical(id('isSensitive'), helperCall))),
            ],
        ],
        [
            'secureTextEntry={false}',
            [attr('secureTextEntry', container(literal(false)))],
        ],
        ['no secureTextEntry', [attr('placeholder')]],
    ])('allows %s', (_label, attributes) => {
        expect(lint(attributes)).not.toHaveBeenCalled()
    })

    it('is enabled at error for mobile source only, outside tests', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const root = readOxlintConfig('.oxlintrc.json')

        const overrides = overridesWith(mobile, 'pera/sensitive-input-props')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual(['src/**'])
        expect(overrides[0].rules['pera/sensitive-input-props']).toBe('error')
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining([
                'src/**/__tests__/**',
                'src/**/*.spec.{ts,tsx}',
            ]),
        )
        expect(JSON.stringify(root)).not.toContain('pera/sensitive-input-props')
    })
})
