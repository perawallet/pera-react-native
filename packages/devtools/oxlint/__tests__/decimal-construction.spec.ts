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
import { decimalConstruction } from '../rules/decimal-construction.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

describe('pera/decimal-construction', () => {
    const lintCall = (node: Node) => {
        const report = vi.fn()
        decimalConstruction.create({ report }).CallExpression(node)
        return report
    }

    it('reports Decimal called without new', () => {
        expect(
            lintCall(call(id('Decimal'), [{ type: 'Literal', value: '1' }])),
        ).toHaveBeenCalledOnce()
    })

    it.each([
        ['a static method', call(member(id('Decimal'), 'max'), [])],
        ['another function', call(id('toDecimal'), [])],
    ])('allows %s', (_label, node) => {
        expect(lintCall(node)).not.toHaveBeenCalled()
    })

    it('runs in one override per config, beside the default decimal.js import ban', () => {
        for (const path of ['.oxlintrc.json', 'apps/mobile/.oxlintrc.json']) {
            const overrides = overridesWith(
                readOxlintConfig(path),
                'pera/decimal-construction',
            )
            expect(overrides).toHaveLength(1)
            expect(overrides[0].rules['no-restricted-imports']).toEqual([
                'error',
                {
                    paths: [
                        {
                            name: 'decimal.js',
                            importNames: ['default'],
                            message:
                                'Import the named { Decimal } from decimal.js.',
                        },
                    ],
                },
            ])
        }
    })
})
