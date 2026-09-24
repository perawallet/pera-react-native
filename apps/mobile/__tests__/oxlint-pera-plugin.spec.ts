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

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import plugin, {
    DAPP_SIGNING_PATHS,
    GALLERY_ENTRY_PATHS,
    WC_CONNECTOR_OWNERS,
} from '../scripts/oxlint-pera-plugin.mjs'

type Node = Record<string, unknown>

const id = (name: string): Node => ({ type: 'Identifier', name })
const member = (object: Node, property: string): Node => ({
    type: 'MemberExpression',
    computed: false,
    object,
    property: id(property),
})
const call = (callee: Node, args: Node[]): Node => ({
    type: 'CallExpression',
    callee,
    arguments: args,
})
const openUrl = (...args: Node[]) =>
    call(member(id('Linking'), 'openURL'), args)

const lint = (node: Node) => {
    const report = vi.fn()
    const rule = plugin.rules['no-unvalidated-open-url']
    rule.create({ report }).CallExpression(node)
    return report
}

describe('pera/no-unvalidated-open-url', () => {
    it.each([
        ['a string literal', openUrl({ type: 'Literal', value: 'https://x' })],
        [
            'a template without expressions',
            openUrl({ type: 'TemplateLiteral', expressions: [] }),
        ],
        [
            'a config member',
            openUrl(member(member(id('config'), 'urls'), 'support')),
        ],
        [
            'another object’s openURL',
            call(member(id('Other'), 'openURL'), [id('url')]),
        ],
    ])('allows %s', (_label, node) => {
        expect(lint(node)).not.toHaveBeenCalled()
    })

    it.each([
        ['an identifier', openUrl(id('url'))],
        ['a non-config member', openUrl(member(id('peer'), 'url'))],
        [
            'a template with expressions',
            openUrl({ type: 'TemplateLiteral', expressions: [id('x')] }),
        ],
        ['no argument', openUrl()],
    ])('reports %s', (_label, node) => {
        expect(lint(node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'unvalidated' }),
        )
    })
})

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
        const rule = plugin.rules['no-hardcoded-ui-strings']
        rule.create({ report })[visitor](node)
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

describe('pera/dev-gallery-entry-points', () => {
    const lintIn = (file: string, visitor: string, node: Node) => {
        const report = vi.fn()
        const rule = plugin.rules['dev-gallery-entry-points']
        const visitors: Partial<Record<string, (node: Node) => void>> =
            rule.create({
                report,
                filename: `/repo/apps/mobile/${file}`,
            })
        visitors[visitor]?.(node)
        return report
    }
    const literal = (value: string): Node => ({ type: 'Literal', value })
    const galleryImport = (importKind = 'value'): Node => ({
        type: 'ImportDeclaration',
        importKind,
        source: literal('./screens/developer/gallery-catalog'),
    })
    const LEAKY = 'src/modules/home/Leaky.ts'

    it.each([
        ['a runtime import', 'ImportDeclaration', galleryImport()],
        [
            'a re-export',
            'ExportNamedDeclaration',
            {
                type: 'ExportNamedDeclaration',
                exportKind: 'value',
                source: literal('../screens/developer/GalleryCategoryScreen'),
            },
        ],
        [
            'a re-export of everything',
            'ExportAllDeclaration',
            {
                type: 'ExportAllDeclaration',
                exportKind: 'value',
                source: literal('../screens/developer/gallery-catalog'),
            },
        ],
        [
            'a deferred import with a template specifier',
            'ImportExpression',
            {
                type: 'ImportExpression',
                source: {
                    type: 'TemplateLiteral',
                    expressions: [],
                    quasis: [
                        {
                            value: {
                                cooked: './screens/developer/SettingsDeveloperGalleryScreen',
                            },
                        },
                    ],
                },
            },
        ],
        [
            'a require',
            'CallExpression',
            {
                type: 'CallExpression',
                callee: { type: 'Identifier', name: 'require' },
                arguments: [
                    literal(
                        './screens/developer/GalleryComponentPreviewScreen',
                    ),
                ],
            },
        ],
    ])('reports %s outside the entry points', (_label, visitor, node) => {
        expect(lintIn(LEAKY, visitor, node as Node)).toHaveBeenCalledOnce()
    })

    it('reports a relative sibling import that resolves into gallery code', () => {
        expect(
            lintIn(
                'src/modules/settings/screens/developer/SettingsDeveloperScreen/index.ts',
                'ImportDeclaration',
                {
                    type: 'ImportDeclaration',
                    importKind: 'value',
                    source: literal('../GalleryCategoryScreen'),
                },
            ),
        ).toHaveBeenCalledOnce()
    })

    it('allows a type-only import', () => {
        expect(
            lintIn(LEAKY, 'ImportDeclaration', galleryImport('type')),
        ).not.toHaveBeenCalled()
    })

    it.each(GALLERY_ENTRY_PATHS)('allows imports from %s', path => {
        const file = path.endsWith('.ts') ? path : `${path}/index.ts`
        expect(
            lintIn(file, 'ImportDeclaration', galleryImport()),
        ).not.toHaveBeenCalled()
    })

    it.each(GALLERY_ENTRY_PATHS)('carves out %s, which still exists', path => {
        expect(existsSync(join(__dirname, '..', path))).toBe(true)
    })
})

describe('pera/no-program-signer-in-dapp-paths', () => {
    const lintSource = (text: string): string[] => {
        const report = vi.fn()
        const rule = plugin.rules['no-program-signer-in-dapp-paths']
        rule.create({ report, sourceCode: { getText: () => text } }).Program()
        return report.mock.calls.map(
            ([{ loc, data }]) =>
                `${data.name}@${loc.start.line}:${loc.start.column}`,
        )
    }

    it('reports program-signer names in code, comments and strings', () => {
        expect(
            lintSource(
                [
                    "import { signProgram } from '../program'",
                    '// falls back to useProgramSigner',
                    "const e = 'encodeDelegatedLsig'",
                ].join('\n'),
            ),
        ).toEqual([
            'signProgram@1:9',
            'useProgramSigner@2:17',
            'encodeDelegatedLsig@3:11',
        ])
    })

    it('allows look-alikes', () => {
        expect(
            lintSource(
                'const cosignProgrammatic = 1\nconst signProgramX = 2\n',
            ),
        ).toEqual([])
    })

    it('is enabled for exactly the dApp signing paths, which still exist', () => {
        const root = join(__dirname, '../../..')
        const config = JSON.parse(
            readFileSync(join(root, '.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: { files: string[]; rules: Record<string, unknown> }[]
        }
        const override = config.overrides.find(
            o => o.rules['pera/no-program-signer-in-dapp-paths'] === 'error',
        )
        expect(override?.files).toEqual(
            DAPP_SIGNING_PATHS.map(p => (p.endsWith('.ts') ? p : `${p}/**`)),
        )
        for (const path of DAPP_SIGNING_PATHS) {
            expect(existsSync(join(root, path)), path).toBe(true)
        }
    })
})

describe('pera/wc-connector-ownership', () => {
    const lintNode = (
        visitor: 'NewExpression' | 'CallExpression',
        node: Node,
    ) => {
        const report = vi.fn()
        plugin.rules['wc-connector-ownership'].create({ report })[visitor](node)
        return report
    }

    it.each([
        [
            'new WalletConnect(...)',
            'NewExpression',
            { type: 'NewExpression', callee: id('WalletConnect') },
        ],
        [
            'createWalletConnectConnector(...)',
            'CallExpression',
            call(id('createWalletConnectConnector'), []),
        ],
        [
            'a member createConnectorRegistry(...)',
            'CallExpression',
            call(member(id('walletconnect'), 'createConnectorRegistry'), []),
        ],
        [
            'createConnectorRegistry(...)',
            'CallExpression',
            call(id('createConnectorRegistry'), []),
        ],
        [
            'useWalletConnect()',
            'CallExpression',
            call(id('useWalletConnect'), []),
        ],
    ] as const)('reports %s', (_label, visitor, node) => {
        expect(lintNode(visitor, node)).toHaveBeenCalledOnce()
    })

    it.each([
        [
            'a look-alike hook',
            'CallExpression',
            call(id('useWalletConnectDeeplink'), []),
        ],
        [
            'another constructor',
            'NewExpression',
            { type: 'NewExpression', callee: id('WalletKit') },
        ],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lintNode(visitor, node)).not.toHaveBeenCalled()
    })

    it('carves out only files that still own a connector', () => {
        const root = join(__dirname, '../../..')
        const ownership =
            /\bnew WalletConnect\(|\bcreateWalletConnectConnector\(|\bcreateConnectorRegistry\(|\buseWalletConnect\(/
        for (const owner of WC_CONNECTOR_OWNERS) {
            const text = readFileSync(join(root, owner), 'utf8')
            expect(ownership.test(text), owner).toBe(true)
        }
    })

    it('is enabled by the root override for WC_CONNECTOR_OWNERS and by mobile for src/**', () => {
        const root = join(__dirname, '../../..')
        const rootConfig = JSON.parse(
            readFileSync(join(root, '.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: {
                files: string[]
                excludeFiles?: string[]
                rules: Record<string, string>
            }[]
        }
        const rootOverride = rootConfig.overrides.find(
            o => o.rules['pera/wc-connector-ownership'] === 'error',
        )
        expect(
            rootOverride?.excludeFiles?.filter(f => f.startsWith('packages/')),
        ).toEqual(WC_CONNECTOR_OWNERS)

        const mobileConfig = JSON.parse(
            readFileSync(join(root, 'apps/mobile/.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: { files: string[]; rules: Record<string, string> }[]
        }
        const mobileOverride = mobileConfig.overrides.find(
            o => o.rules['pera/wc-connector-ownership'] === 'error',
        )
        expect(mobileOverride?.files).toEqual(['src/**'])
    })
})

describe('every pera plugin rule', () => {
    type Config = {
        rules?: Record<string, string>
        overrides?: { rules?: Record<string, string> }[]
    }
    const root = join(__dirname, '../../..')
    const readConfig = (path: string): Config =>
        JSON.parse(readFileSync(join(root, path), 'utf8')) as Config
    const rootConfig = readConfig('.oxlintrc.json')
    const mobileConfig = readConfig('apps/mobile/.oxlintrc.json')

    const enables = (config: Config, ruleId: string): boolean =>
        config.rules?.[ruleId] === 'error' ||
        config.rules?.[ruleId] === 'warn' ||
        (config.overrides ?? []).some(
            o => o.rules?.[ruleId] === 'error' || o.rules?.[ruleId] === 'warn',
        )

    it.each(Object.keys(plugin.rules))(
        'pera/%s is enabled by an override',
        id => {
            const ruleId = `pera/${id}`
            expect(
                enables(rootConfig, ruleId) || enables(mobileConfig, ruleId),
            ).toBe(true)
        },
    )
})

describe('pera/no-platform-os-web', () => {
    const platformOs = member(id('Platform'), 'OS')
    const literal = (value: string): Node => ({ type: 'Literal', value })
    const compare = (operator: string, left: Node, right: Node): Node => ({
        type: 'BinaryExpression',
        operator,
        left,
        right,
    })
    const switchOn = (discriminant: Node, ...tests: Node[]): Node => ({
        type: 'SwitchStatement',
        discriminant,
        cases: tests.map(test => ({ type: 'SwitchCase', test })),
    })

    const lintWeb = (node: Node) => {
        const report = vi.fn()
        const visitors = plugin.rules['no-platform-os-web'].create({ report })
        const visit = visitors[node.type as keyof typeof visitors]
        visit(node)
        return report
    }

    it.each([
        ['=== web', compare('===', platformOs, literal('web'))],
        ['!== web', compare('!==', platformOs, literal('web'))],
        ['== web', compare('==', platformOs, literal('web'))],
        ['a reversed comparison', compare('===', literal('web'), platformOs)],
        [
            "a switch with case 'web'",
            switchOn(platformOs, literal('ios'), literal('web')),
        ],
    ])('reports %s', (_label, node) => {
        expect(lintWeb(node)).toHaveBeenCalledWith(
            expect.objectContaining({ messageId: 'web' }),
        )
    })

    it.each([
        ['=== ios', compare('===', platformOs, literal('ios'))],
        [
            'another object’s OS',
            compare('===', member(id('device'), 'OS'), literal('web')),
        ],
        ['a non-equality operator', compare('+', platformOs, literal('web'))],
        [
            'a switch without a web case',
            switchOn(platformOs, literal('ios'), literal('android')),
        ],
        ['a switch on something else', switchOn(id('surface'), literal('web'))],
    ])('allows %s', (_label, node) => {
        expect(lintWeb(node)).not.toHaveBeenCalled()
    })
})
