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

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    MAX_PARENT_HOPS,
    MOBILE_PATH_ALIASES,
    noDeepRelativeImports,
} from '../rules/no-deep-relative-imports.js'
import { call, id, type Node } from './helpers.js'

const mobileRoot = join(__dirname, '../../../../apps/mobile')

type Report = {
    node: Node
    data: { specifier: string; replacement: string }
    fix: (fixer: {
        replaceText: (node: Node, text: string) => string
    }) => string
}

describe('pera/no-deep-relative-imports', () => {
    const lintIn = (filename: string, visitor: string, node: Node) => {
        const report = vi.fn()
        const visitors: Partial<Record<string, (node: Node) => void>> =
            noDeepRelativeImports.create({ report, filename })
        visitors[visitor]?.(node)
        return report
    }
    const literal = (value: string): Node => ({ type: 'Literal', value })
    const template = (value: string, expressions: Node[] = []): Node => ({
        type: 'TemplateLiteral',
        expressions,
        quasis: [{ value: { cooked: value } }],
    })
    const importFrom = (value: string, importKind = 'value'): Node => ({
        type: 'ImportDeclaration',
        importKind,
        source: literal(value),
    })
    const fixed = (report: ReturnType<typeof vi.fn>): string =>
        (report.mock.calls[0][0] as Report).fix({
            replaceText: (_node, text) => text,
        })

    const REKEY_SCREEN =
        '/repo/apps/mobile/src/modules/rekey/screens/rekey-to-ledger/RekeyToLedgerConfirmScreen/RekeyToLedgerConfirmScreen.tsx'
    const LANGUAGE_HOOK =
        '/repo/apps/mobile/src/modules/settings/screens/SettingsLanguageScreen/useSettingsLanguageScreen.ts'
    const DEEP = '../../../components/RekeyConfirmView'

    it('rewrites a three-hop import to the module alias', () => {
        const report = lintIn(
            REKEY_SCREEN,
            'ImportDeclaration',
            importFrom(DEEP),
        )

        expect(report).toHaveBeenCalledOnce()
        expect(fixed(report)).toBe(
            "'@modules/rekey/components/RekeyConfirmView'",
        )
    })

    it('flags a type-only import', () => {
        const report = lintIn(
            REKEY_SCREEN,
            'ImportDeclaration',
            importFrom(DEEP, 'type'),
        )

        expect(report).toHaveBeenCalledOnce()
        expect(fixed(report)).toBe(
            "'@modules/rekey/components/RekeyConfirmView'",
        )
    })

    it('reports the written specifier and its replacement', () => {
        const report = lintIn(
            LANGUAGE_HOOK,
            'ImportDeclaration',
            importFrom('../../../../i18n/locales'),
        )

        expect((report.mock.calls[0][0] as Report).data).toEqual({
            specifier: '../../../../i18n/locales',
            replacement: '@i18n/locales',
        })
        expect(fixed(report)).toBe("'@i18n/locales'")
    })

    it.each([
        [
            'a re-export',
            'ExportNamedDeclaration',
            { type: 'ExportNamedDeclaration', source: literal(DEEP) },
        ],
        [
            'a re-export of everything',
            'ExportAllDeclaration',
            { type: 'ExportAllDeclaration', source: literal(DEEP) },
        ],
        [
            'a dynamic import',
            'ImportExpression',
            { type: 'ImportExpression', source: literal(DEEP) },
        ],
        [
            'a require of a plain template literal',
            'CallExpression',
            call(id('require'), [template(DEEP)]),
        ],
    ])('flags %s', (_name, visitor, node) => {
        const report = lintIn(REKEY_SCREEN, visitor, node)

        expect(report).toHaveBeenCalledOnce()
        expect(fixed(report)).toBe(
            "'@modules/rekey/components/RekeyConfirmView'",
        )
    })

    it.each([
        [
            'a hooks import',
            'src/modules/a/hooks/b/useX.ts',
            '../../../../hooks/useLanguage',
            '@hooks/useLanguage',
        ],
        [
            'an asset outside src',
            'src/modules/a/b/x.ts',
            '../../../../assets/images/y.png',
            '@assets/images/y.png',
        ],
        [
            'a bare aliased directory',
            'src/modules/a/b/c.ts',
            '../../../i18n',
            '@i18n/index',
        ],
    ])('rewrites %s', (_name, file, specifier, replacement) => {
        const report = lintIn(
            `/repo/apps/mobile/${file}`,
            'ImportDeclaration',
            importFrom(specifier),
        )

        expect(report).toHaveBeenCalledOnce()
        expect(fixed(report)).toBe(`'${replacement}'`)
    })

    it.each([
        ['a sibling', 'src/modules/a/b/x.ts', './styles'],
        ['a parent', 'src/modules/a/b/x.ts', '../Sub'],
        ['two hops', 'src/modules/a/b/x.ts', '../../hooks/useX'],
        [
            'a target inside its own component folder',
            'src/components/core/PWFoo/parts/a/b/x.ts',
            '../../../PWFoo',
        ],
        [
            'an unaliased src directory',
            'src/modules/a/b/x.ts',
            '../../../types/y',
        ],
        [
            'a target outside the app',
            'src/modules/a/x.ts',
            '../../../../packages/shared/src/x',
        ],
        [
            'a package specifier',
            'src/modules/a/x.ts',
            '@perawallet/wallet-core-shared',
        ],
    ])('allows %s', (_name, file, specifier) => {
        const report = lintIn(
            `/repo/apps/mobile/${file}`,
            'ImportDeclaration',
            importFrom(specifier),
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('flags exactly one hop past MAX_PARENT_HOPS', () => {
        const file = '/repo/apps/mobile/src/modules/a/b/c/x.ts'
        const within = lintIn(
            file,
            'ImportDeclaration',
            importFrom(`${'../'.repeat(MAX_PARENT_HOPS)}hooks/useX`),
        )
        const beyond = lintIn(
            file,
            'ImportDeclaration',
            importFrom(`${'../'.repeat(MAX_PARENT_HOPS + 1)}hooks/useX`),
        )

        expect(within).not.toHaveBeenCalled()
        expect(beyond).toHaveBeenCalledOnce()
    })

    it('allows a template literal with an expression', () => {
        const report = lintIn(
            REKEY_SCREEN,
            'CallExpression',
            call(id('require'), [template(DEEP, [id('name')])]),
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('allows a require of an identifier', () => {
        const report = lintIn(
            REKEY_SCREEN,
            'CallExpression',
            call(id('require'), [id('name')]),
        )

        expect(report).not.toHaveBeenCalled()
    })

    it('allows a local export without a source', () => {
        const report = lintIn(REKEY_SCREEN, 'ExportNamedDeclaration', {
            type: 'ExportNamedDeclaration',
            source: null,
        })

        expect(report).not.toHaveBeenCalled()
    })

    it('reports identically for a filename relative to apps/mobile', () => {
        const report = lintIn(
            REKEY_SCREEN.replace('/repo/apps/mobile/', ''),
            'ImportDeclaration',
            importFrom(DEEP),
        )

        expect(report).toHaveBeenCalledOnce()
        expect(fixed(report)).toBe(
            "'@modules/rekey/components/RekeyConfirmView'",
        )
    })
})

describe('MOBILE_PATH_ALIASES', () => {
    const babelAliases = (): Record<string, string> => {
        const load = createRequire(join(mobileRoot, 'package.json'))
        const config = load('./babel.config.js')({
            cache: () => undefined,
        }) as {
            plugins: [string, { alias: Record<string, string> }][]
        }
        const resolver = config.plugins.find(
            plugin => Array.isArray(plugin) && plugin[0] === 'module-resolver',
        )
        return resolver![1].alias
    }
    const tsconfigPaths = (): Record<string, string[]> => {
        const text = readFileSync(join(mobileRoot, 'tsconfig.json'), 'utf8')
        return JSON.parse(text.replace(/^\s*\/\/.*$/gm, '')).compilerOptions
            .paths
    }

    it('names exactly the aliases babel resolves', () => {
        expect(Object.keys(MOBILE_PATH_ALIASES).sort()).toEqual(
            Object.keys(babelAliases()).sort(),
        )
    })

    it('maps each alias to the directory babel and tsc map it to', () => {
        const babel = babelAliases()
        const paths = tsconfigPaths()

        for (const [alias, directory] of Object.entries(MOBILE_PATH_ALIASES)) {
            expect(babel[alias]).toBe(`./${directory}`)
            expect(paths[`${alias}/*`]).toEqual([`./${directory}/*`])
        }
    })
})
