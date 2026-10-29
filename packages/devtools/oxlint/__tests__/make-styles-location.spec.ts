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
import { makeStylesLocation } from '../rules/make-styles-location.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

describe('pera/make-styles-location', () => {
    const lintIn = (filename: string, ...nodes: Node[]) => {
        const report = vi.fn()
        const visitors: Partial<Record<string, (node: Node) => void>> =
            makeStylesLocation.create({ report, filename })
        for (const node of nodes) visitors[node.type as string]?.(node)
        return report
    }
    const rneuiImport = (local = 'makeStyles', importKind = 'value'): Node => ({
        type: 'ImportDeclaration',
        importKind,
        source: { type: 'Literal', value: '@rneui/themed' },
        specifiers: [
            {
                type: 'ImportSpecifier',
                importKind: 'value',
                imported: id('makeStyles'),
                local: id(local),
            },
        ],
    })
    const makeStylesCall = call(id('makeStyles'), [])

    it.each([
        '/repo/apps/mobile/src/components/Foo/Foo.tsx',
        'src/modules/x/Foo.style.ts',
        'src/components/core/PWTabView/tabBarStyles.ts',
        'src/hooks/useToast.ts',
        '/repo/apps/mobile/src/AppShell.web.tsx',
        'src/components/Foo/mystyles.ts',
    ])('reports a makeStyles call in %s', filename => {
        const report = lintIn(filename, rneuiImport(), makeStylesCall)

        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'location' }),
        )
    })

    it('reports an aliased import', () => {
        const report = lintIn(
            'src/components/Foo/Foo.tsx',
            rneuiImport('ms'),
            call(id('ms'), []),
        )

        expect(report).toHaveBeenCalledOnce()
    })

    it.each([
        '/repo/apps/mobile/src/components/Foo/styles.ts',
        'src/components/Foo/styles.ts',
        'src/components/Foo/styles.web.ts',
        'src/components/Foo/styles.ios.ts',
    ])('allows the call in %s', filename => {
        const report = lintIn(filename, rneuiImport(), makeStylesCall)

        expect(report).not.toHaveBeenCalled()
    })

    it.each([
        ['a local function with the same name', []],
        [
            'a makeStyles from another module',
            [
                {
                    ...rneuiImport(),
                    source: { type: 'Literal', value: './my-styles' },
                },
            ],
        ],
        ['a type-only import', [rneuiImport('makeStyles', 'type')]],
    ])('allows %s', (_label, imports) => {
        const report = lintIn(
            'src/components/Foo/Foo.tsx',
            ...(imports as Node[]),
            makeStylesCall,
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('allows a member call', () => {
        const report = lintIn(
            'src/components/Foo/Foo.tsx',
            rneuiImport(),
            call(member(id('theme'), 'makeStyles'), []),
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('ships at error for mobile source outside tests, and nowhere else', () => {
        const overrides = overridesWith(
            readOxlintConfig('apps/mobile/.oxlintrc.json'),
            'pera/make-styles-location',
        )

        expect(overrides).toHaveLength(1)
        expect(overrides[0].rules['pera/make-styles-location']).toBe('error')
        expect(overrides[0].files).toEqual(['src/**/*.{ts,tsx}'])
        expect(overrides[0].excludeFiles).toEqual([
            'src/**/__tests__/**',
            'src/**/__mocks__/**',
            'src/**/test-utils/**',
            'src/**/__integration__/**',
            'src/**/*.spec.{ts,tsx}',
            'src/**/*.test.{ts,tsx}',
        ])
        expect(
            overridesWith(
                readOxlintConfig('.oxlintrc.json'),
                'pera/make-styles-location',
            ),
        ).toHaveLength(0)
    })
})
