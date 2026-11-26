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
import { noInputLabelStyle } from '../rules/no-input-label-style.js'
import { id, overridesWith, readOxlintConfig, type Node } from './helpers.js'

describe('pera/no-input-label-style', () => {
    const attr = (name: string): Node => ({
        type: 'JSXAttribute',
        name: { type: 'JSXIdentifier', name },
        value: {
            type: 'JSXExpressionContainer',
            expression: id('styles'),
        },
    })
    const opening = (element: string, attributes: Node[]): Node => ({
        type: 'JSXOpeningElement',
        name: { type: 'JSXIdentifier', name: element },
        attributes,
    })
    const lint = (element: string, attributes: Node[]) => {
        const report = vi.fn()
        noInputLabelStyle
            .create({ report })
            .JSXOpeningElement(opening(element, attributes))
        return report
    }

    it.each(['PWInput', 'Input'])('reports labelStyle on %s', element => {
        const labelStyle = attr('labelStyle')

        const report = lint(element, [attr('label'), labelStyle])

        expect(report).toHaveBeenCalledOnce()
        expect(report).toHaveBeenCalledWith({
            node: labelStyle,
            messageId: 'custom',
        })
    })

    it('ignores label, style and inputStyle', () => {
        const report = lint('PWInput', [
            attr('label'),
            attr('style'),
            attr('inputStyle'),
        ])

        expect(report).not.toHaveBeenCalled()
    })

    it('is enabled at error for mobile source only, outside tests', () => {
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const root = readOxlintConfig('.oxlintrc.json')

        const overrides = overridesWith(mobile, 'pera/no-input-label-style')

        expect(overrides).toHaveLength(1)
        expect(overrides[0].files).toEqual(['src/**'])
        expect(overrides[0].rules['pera/no-input-label-style']).toBe('error')
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining([
                'src/**/__tests__/**',
                'src/**/*.spec.{ts,tsx}',
            ]),
        )
        expect(JSON.stringify(root)).not.toContain('pera/no-input-label-style')
    })
})
