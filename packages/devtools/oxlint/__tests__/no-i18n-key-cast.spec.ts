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
import { noI18nKeyCast } from '../rules/no-i18n-key-cast.js'
import { id, overridesWith, readOxlintConfig, type Node } from './helpers.js'

describe('pera/no-i18n-key-cast', () => {
    const typeRef = (name: string, ...params: Node[]): Node => ({
        type: 'TSTypeReference',
        typeName: id(name),
        ...(params.length > 0
            ? {
                  typeArguments: {
                      type: 'TSTypeParameterInstantiation',
                      params,
                  },
              }
            : {}),
    })
    const asExpression = (typeAnnotation: Node): Node => ({
        type: 'TSAsExpression',
        expression: id('x'),
        typeAnnotation,
    })
    const typeAssertion = (typeAnnotation: Node): Node => ({
        type: 'TSTypeAssertion',
        expression: id('x'),
        typeAnnotation,
    })
    const lint = (
        visitor: 'TSAsExpression' | 'TSTypeAssertion',
        node: Node,
    ) => {
        const report = vi.fn()
        noI18nKeyCast.create({ report })[visitor](node)
        return report
    }

    it.each([
        ['x as I18nKey', 'TSAsExpression', asExpression(typeRef('I18nKey'))],
        ['<I18nKey>x', 'TSTypeAssertion', typeAssertion(typeRef('I18nKey'))],
        [
            'x as unknown as I18nKey',
            'TSAsExpression',
            {
                type: 'TSAsExpression',
                expression: asExpression(typeRef('unknown')),
                typeAnnotation: typeRef('I18nKey'),
            },
        ],
        [
            'x as Record<string, I18nKey>',
            'TSAsExpression',
            asExpression(
                typeRef('Record', typeRef('string'), typeRef('I18nKey')),
            ),
        ],
        [
            'x as chain.I18nKey',
            'TSAsExpression',
            asExpression({
                type: 'TSTypeReference',
                typeName: {
                    type: 'TSQualifiedName',
                    left: id('chain'),
                    right: id('I18nKey'),
                },
            }),
        ],
    ] as const)('reports %s', (_label, visitor, node) => {
        expect(lint(visitor, node)).toHaveBeenCalledOnce()
    })

    it.each([
        ['x as string', asExpression(typeRef('string'))],
        ['x as const', asExpression(typeRef('const'))],
        [
            'x as Record<string, number>',
            asExpression(
                typeRef('Record', typeRef('string'), typeRef('number')),
            ),
        ],
    ])('allows %s', (_label, node) => {
        expect(lint('TSAsExpression', node)).not.toHaveBeenCalled()
    })

    it('is on at the top level of the root config and off only where the constructor lives', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const { rules } = root as unknown as {
            rules: Record<string, unknown>
        }

        expect(rules['pera/no-i18n-key-cast']).toBe('error')
        expect(
            overridesWith(root, 'pera/no-i18n-key-cast').map(o => [
                o.files,
                o.rules['pera/no-i18n-key-cast'],
            ]),
        ).toEqual([[['packages/chain-contract/src/models/i18n.ts'], 'off']])
    })
})
