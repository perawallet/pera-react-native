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

import {
    fromAppRoot,
    resolveSibling,
    staticSpecifier,
} from '../shared/import-paths.js'

export const MAX_PARENT_HOPS = 2

// Directories relative to apps/mobile. Each resolves identically under Metro
// (babel module-resolver), tsc paths and vitest, which is what lets the fix
// rewrite to them; @browser, @packages and @test-utils are left out because
// Metro cannot resolve them from app source.
export const MOBILE_PATH_ALIASES = Object.freeze({
    '@analytics': 'src/analytics',
    '@assets': 'assets',
    '@components': 'src/components',
    '@constants': 'src/constants',
    '@hooks': 'src/hooks',
    '@i18n': 'src/i18n',
    '@layouts': 'src/layouts',
    '@modules': 'src/modules',
    '@providers': 'src/providers',
    '@routes': 'src/routes',
    '@theme': 'src/theme',
    '@utils': 'src/utils',
})

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/

const parentHops = specifier => {
    let hops = 0
    for (const part of specifier.split('/')) {
        if (part === '.') continue
        if (part !== '..') break
        hops += 1
    }
    return hops
}

// Component and screen folders are PascalCase, grouping folders kebab-case
// (apps/mobile/CLAUDE.md), so the outermost PascalCase directory is the folder
// that owns the file.
const componentRootOf = file => {
    const directories = file.split('/').slice(0, -1)
    const at = directories.findIndex(part => PASCAL_CASE.test(part))
    return at === -1 ? undefined : directories.slice(0, at + 1).join('/')
}

const aliasedSpecifier = target => {
    for (const [alias, directory] of Object.entries(MOBILE_PATH_ALIASES)) {
        if (target === directory) return `${alias}/index`
        if (target.startsWith(`${directory}/`)) {
            return `${alias}/${target.slice(directory.length + 1)}`
        }
    }
    return undefined
}

export const noDeepRelativeImports = {
    meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
            description:
                'Reach an aliased directory three or more levels up through its path alias',
        },
        messages: {
            alias: 'Import {{replacement}} instead of {{specifier}}: a path alias survives a move and names the layer it reaches.',
        },
        schema: [],
    },
    create(context) {
        const file = fromAppRoot(context.filename)
        const check = source => {
            const specifier = staticSpecifier(source)
            if (specifier === undefined || !specifier.startsWith('.')) return
            const hops = parentHops(specifier)
            if (hops <= MAX_PARENT_HOPS) return
            // Climbing past the app root lands outside it (packages/*), which no app alias covers.
            if (hops > file.split('/').length - 1) return
            const target = resolveSibling(file, specifier)
            const componentRoot = componentRootOf(file)
            if (
                componentRoot !== undefined &&
                (target === componentRoot ||
                    target.startsWith(`${componentRoot}/`))
            ) {
                return
            }
            const replacement = aliasedSpecifier(target)
            if (replacement === undefined) return
            context.report({
                node: source,
                messageId: 'alias',
                data: { specifier, replacement },
                fix: fixer => fixer.replaceText(source, `'${replacement}'`),
            })
        }
        return {
            ImportDeclaration(node) {
                check(node.source)
            },
            ExportNamedDeclaration(node) {
                if (node.source) check(node.source)
            },
            ExportAllDeclaration(node) {
                check(node.source)
            },
            ImportExpression(node) {
                check(node.source)
            },
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'require'
                ) {
                    check(node.arguments[0])
                }
            },
        }
    },
}
