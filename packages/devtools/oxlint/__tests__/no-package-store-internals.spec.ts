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
import { noPackageStoreInternals } from '../rules/no-package-store-internals.js'
import {
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

const RULE = 'pera/no-package-store-internals'

type Spec = {
    type: 'ImportSpecifier' | 'ImportNamespaceSpecifier'
    imported?: string
    local: string
    importKind?: 'type' | 'value'
}

const named = (imported: string, local = imported): Spec => ({
    type: 'ImportSpecifier',
    imported,
    local,
})

const importFrom = (
    source: string,
    specifiers: Spec[],
    importKind: 'type' | 'value' = 'value',
): Node => ({
    type: 'ImportDeclaration',
    importKind,
    source: { type: 'Literal', value: source },
    specifiers: specifiers.map(spec => ({
        type: spec.type,
        importKind: spec.importKind ?? 'value',
        imported: spec.imported ? id(spec.imported) : undefined,
        local: id(spec.local),
    })),
})

const computedMember = (object: Node, key: string): Node => ({
    type: 'MemberExpression',
    computed: true,
    object,
    property: { type: 'Literal', value: key },
})

const lint = (imports: Node[], expressions: Node[]) => {
    const report = vi.fn()
    const visitor = noPackageStoreInternals.create({ report })
    visitor.Program({ type: 'Program', body: imports })
    for (const expression of expressions) visitor.MemberExpression(expression)
    return report
}

const cardImport = importFrom('@perawallet/wallet-core-card', [
    named('useCardStore'),
])

describe(RULE, () => {
    it.each([
        ['getState', member(id('useCardStore'), 'getState')],
        ['setState', member(id('useCardStore'), 'setState')],
        ['a computed setState', computedMember(id('useCardStore'), 'setState')],
    ])('flags %s on a package store', (_label, expression) => {
        const report = lint([cardImport], [expression])

        expect(report).toHaveBeenCalledOnce()
        expect(report.mock.calls[0][0].messageId).toBe('internals')
    })

    it('reports an aliased import under its local name', () => {
        const report = lint(
            [
                importFrom('@perawallet/wallet-core-card', [
                    named('useCardStore', 'cardStore'),
                ]),
            ],
            [member(id('cardStore'), 'getState')],
        )

        expect(report.mock.calls[0][0].data).toEqual({
            name: 'cardStore',
            method: 'getState',
        })
    })

    it('flags a store reached through a namespace import', () => {
        const report = lint(
            [
                importFrom('@perawallet/wallet-core-card', [
                    { type: 'ImportNamespaceSpecifier', local: 'card' },
                ]),
            ],
            [member(member(id('card'), 'useCardStore'), 'getState')],
        )

        expect(report.mock.calls[0][0].data).toEqual({
            name: 'card.useCardStore',
            method: 'getState',
        })
    })

    it('flags a reference that is not called', () => {
        const report = lint(
            [
                importFrom('@perawallet/wallet-core-connections', [
                    named('useConnectionsStore'),
                ]),
            ],
            [member(id('useConnectionsStore'), 'getState')],
        )

        expect(report).toHaveBeenCalledOnce()
    })

    it.each([
        [
            'an app-local store from a path alias',
            importFrom('@modules/bottom-sheet', [
                named('useBottomSheetStore'),
            ]),
            'useBottomSheetStore',
        ],
        [
            'an app-local store from a relative path',
            importFrom('../stores/usePendingSignaturesSheetStore', [
                named('usePendingSignaturesSheetStore'),
            ]),
            'usePendingSignaturesSheetStore',
        ],
        [
            'a package export that is not a store',
            importFrom('@perawallet/wallet-core-card', [named('cardStateOf')]),
            'cardStateOf',
        ],
        [
            'a type-only import',
            importFrom(
                '@perawallet/wallet-core-card',
                [named('useCardStore')],
                'type',
            ),
            'useCardStore',
        ],
        [
            'a type-only specifier',
            importFrom('@perawallet/wallet-core-card', [
                { ...named('useCardStore'), importKind: 'type' },
            ]),
            'useCardStore',
        ],
    ])('allows %s', (_label, declaration, local) => {
        const report = lint([declaration], [member(id(local), 'getState')])

        expect(report).not.toHaveBeenCalled()
    })

    it('allows a store declared in the same file', () => {
        const report = lint([], [member(id('useCardStore'), 'getState')])

        expect(report).not.toHaveBeenCalled()
    })

    it('allows other members of a package store', () => {
        const report = lint(
            [cardImport],
            [member(id('useCardStore'), 'subscribe')],
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('ships as the only mobile override, at error, outside tests', () => {
        const overrides = overridesWith(
            readOxlintConfig('apps/mobile/.oxlintrc.json'),
            RULE,
        )

        expect(overrides).toHaveLength(1)
        expect(overrides[0].rules[RULE]).toBe('error')
        expect(overrides[0].files).toEqual([
            'src/modules/**',
            'src/components/**',
        ])
        expect(overrides[0].excludeFiles).toContain('src/**/__tests__/**')
    })
})
