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
import { typedDomainErrors } from '../rules/typed-domain-errors.js'
import {
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

describe('pera/typed-domain-errors', () => {
    const lint = (
        visitor: 'ClassDeclaration' | 'ClassExpression',
        node: Node,
    ) => {
        const report = vi.fn()
        typedDomainErrors.create({ report })[visitor](node)
        return report
    }
    const declaration = (superClass: Node | null, extra: Node = {}): Node => ({
        type: 'ClassDeclaration',
        id: id('X'),
        superClass,
        ...extra,
    })
    const expression = (superClass: Node | null): Node => ({
        type: 'ClassExpression',
        id: null,
        superClass,
    })

    it.each([
        ['class X extends Error', 'ClassDeclaration', id('Error'), declaration],
        [
            'const X = class extends Error',
            'ClassExpression',
            id('Error'),
            expression,
        ],
        [
            'class X extends globalThis.Error',
            'ClassDeclaration',
            member(id('globalThis'), 'Error'),
            declaration,
        ],
    ] as const)(
        'reports %s on the superclass',
        (_label, visitor, superClass, build) => {
            const report = lint(visitor, build(superClass))

            expect(report).toHaveBeenCalledOnce()
            expect(report).toHaveBeenCalledWith({
                node: superClass,
                messageId: 'bareError',
            })
        },
    )

    it('reports a class that also implements an interface', () => {
        const report = lint(
            'ClassDeclaration',
            declaration(id('Error'), {
                implements: [{ type: 'TSClassImplements' }],
            }),
        )

        expect(report).toHaveBeenCalledOnce()
    })

    it.each([
        ['extends AppError', id('AppError')],
        ['extends a domain base', id('KeyManagementError')],
        ['no superclass', null],
        ['extends errors.Error', member(id('errors'), 'Error')],
        ['extends TypeError', id('TypeError')],
    ])('allows %s', (_label, superClass) => {
        expect(
            lint('ClassDeclaration', declaration(superClass)),
        ).not.toHaveBeenCalled()
        expect(
            lint('ClassExpression', expression(superClass)),
        ).not.toHaveBeenCalled()
    })

    it('is enabled at error by one package and extension source override only', () => {
        const root = readOxlintConfig('.oxlintrc.json')
        const { rules } = root as unknown as { rules: Record<string, unknown> }

        const overrides = overridesWith(root, 'pera/typed-domain-errors')

        expect(rules['pera/typed-domain-errors']).toBeUndefined()
        expect(overrides).toHaveLength(1)
        expect(overrides[0].rules['pera/typed-domain-errors']).toBe('error')
        expect(overrides[0].files).toEqual([
            'packages/*/src/**',
            'extensions/*/src/**',
        ])
        expect(overrides[0].excludeFiles).toEqual(
            expect.arrayContaining([
                '**/__tests__/**',
                '**/__mocks__/**',
                '**/test-utils/**',
                '**/*.spec.{ts,tsx}',
            ]),
        )
    })
})
