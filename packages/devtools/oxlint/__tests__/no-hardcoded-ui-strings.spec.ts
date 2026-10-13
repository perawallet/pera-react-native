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

    const lintJsx = (visitor: 'JSXElement' | 'JSXAttribute', node: Node) => {
        const report = vi.fn()
        noHardcodedUiStrings.create({ report })[visitor](node)
        return report
    }

    it.each([
        [
            'a text-only <Text>',
            'JSXElement',
            element('Text', [jsxText('Hello there')]),
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
    ] as const)('reports %s', (_label, visitor, node) => {
        expect(lintJsx(visitor, node)).toHaveBeenCalledOnce()
    })

    it.each([
        ['an expression child', 'JSXElement', element('Text', [expression])],
        [
            'digits and punctuation',
            'JSXElement',
            element('Text', [jsxText(' 42 ')]),
        ],
        [
            'a component other than Text',
            'JSXElement',
            element('PWText', [jsxText('Hi')]),
        ],
        ['an expression prop', 'JSXAttribute', attribute('title', expression)],
        [
            'a prop outside the list',
            'JSXAttribute',
            attribute('accessibilityLabel', literal('No')),
        ],
        ['an empty prop', 'JSXAttribute', attribute('body', literal(''))],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lintJsx(visitor, node)).not.toHaveBeenCalled()
    })
})
