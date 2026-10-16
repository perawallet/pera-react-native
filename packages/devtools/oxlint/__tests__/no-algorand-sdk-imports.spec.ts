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
import { noAlgorandSdkImports } from '../rules/no-algorand-sdk-imports.js'
import { overridesWith, readOxlintConfig } from './helpers.js'

describe('pera/no-algorand-sdk-imports', () => {
    const lint = (
        visitor:
            | 'ImportDeclaration'
            | 'ExportNamedDeclaration'
            | 'ExportAllDeclaration'
            | 'ImportExpression',
        source: string | null,
    ) => {
        const report = vi.fn()
        noAlgorandSdkImports.create({ report })[visitor]({
            source: source === null ? null : { type: 'Literal', value: source },
        })
        return report
    }

    it.each([
        ['an algosdk import', 'ImportDeclaration', 'algosdk'],
        [
            'an algokit-utils subpath import',
            'ImportDeclaration',
            '@algorandfoundation/algokit-utils/types/amount',
        ],
        ['a re-export', 'ExportNamedDeclaration', 'algosdk'],
        [
            'an export-all',
            'ExportAllDeclaration',
            '@algorandfoundation/algokit-utils',
        ],
        ['a dynamic import', 'ImportExpression', 'algosdk'],
    ] as const)('warns on %s', (_label, visitor, source) => {
        expect(lint(visitor, source)).toHaveBeenCalledOnce()
    })

    it.each([
        ['a platform-layer package', '@algorandfoundation/keystore-core'],
        ['a look-alike name', 'algosdk-extra'],
    ])('allows %s', (_label, source) => {
        expect(lint('ImportDeclaration', source)).not.toHaveBeenCalled()
    })

    it('ignores a local export with no source', () => {
        expect(lint('ExportNamedDeclaration', null)).not.toHaveBeenCalled()
    })

    it('is an error at the root, and only chain-algorand, the conformance harness and tests turn it off', () => {
        const RULE = 'pera/no-algorand-sdk-imports'
        const root = readOxlintConfig('.oxlintrc.json')
        const mobile = readOxlintConfig('apps/mobile/.oxlintrc.json')
        const rootRules = (
            root as unknown as { rules: Record<string, unknown> }
        ).rules

        expect(rootRules[RULE]).toBe('error')
        for (const config of [root, mobile]) {
            expect(
                overridesWith(config, RULE).every(o => o.rules[RULE] === 'off'),
            ).toBe(true)
        }
        expect(
            overridesWith(root, RULE)
                .flatMap(o => o.files)
                .sort(),
        ).toEqual(
            [
                'packages/chain-algorand/**',
                'conformance/**',
                '**/__tests__/**',
                '**/*.spec.{ts,tsx}',
                '**/__integration__/**',
                '**/vitest*.ts',
            ].sort(),
        )
    })
})
