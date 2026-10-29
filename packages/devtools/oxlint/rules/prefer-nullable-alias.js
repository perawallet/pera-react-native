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

import { insertImportDeclaration } from '../shared/import-fix.js'

/**
 * Code that cannot import `@perawallet/wallet-core-shared`, relative to the
 * repo root. The root override lists every entry in `excludeFiles`.
 */
export const NULLABLE_ALIAS_EXCLUDED_PATHS = [
    // Defines the aliases, and a package cannot import itself by name.
    'packages/shared/src/**',
    // wallet-core-shared depends on it, so importing shared back is a cycle.
    'packages/chain-contract/src/**',
    // wallet-core-shared depends on it, so importing shared back is a cycle.
    'packages/config/src/**',
]

const ALIAS_SOURCE = '@perawallet/wallet-core-shared'

const isNullish = node =>
    node.type === 'TSNullKeyword' || node.type === 'TSUndefinedKeyword'

const aliasFor = (hasNull, hasUndefined) => {
    if (hasNull && hasUndefined) return 'Maybe'
    return hasNull ? 'Nullable' : 'Optional'
}

const matchNullableUnion = node => {
    const members = node.types.filter(t => !isNullish(t))
    const nullish = node.types.filter(isNullish)
    if (members.length !== 1 || nullish.length === 0) return undefined

    const hasNull = nullish.some(t => t.type === 'TSNullKeyword')
    const hasUndefined = nullish.some(t => t.type === 'TSUndefinedKeyword')
    if (nullish.length !== Number(hasNull) + Number(hasUndefined)) {
        return undefined
    }

    const [member] = members
    // `readonly` is a type operator that an alias argument cannot carry through.
    if (member.type === 'TSTypeOperator' && member.operator === 'readonly') {
        return undefined
    }
    return { member, alias: aliasFor(hasNull, hasUndefined) }
}

const findVariable = (scope, name) => {
    for (let s = scope; s; s = s.upper) {
        const variable = s.set.get(name)
        if (variable) return variable
    }
    return undefined
}

const isSharedImport = variable =>
    variable.defs.length === 1 &&
    variable.defs[0].type === 'ImportBinding' &&
    variable.defs[0].parent.source.value === ALIAS_SOURCE

const isNamedOnly = declaration =>
    declaration.specifiers.length > 0 &&
    declaration.specifiers.every(s => s.type === 'ImportSpecifier')

const aliasImportFix = (fixer, program, alias) => {
    const imports = program.body.filter(
        n => n.type === 'ImportDeclaration' && n.source.value === ALIAS_SOURCE,
    )

    const typeImport = imports.find(
        n => n.importKind === 'type' && isNamedOnly(n),
    )
    if (typeImport) {
        return fixer.insertTextAfter(
            typeImport.specifiers.at(-1),
            `, ${alias}`,
        )
    }

    // import/no-duplicates (prefer-inline) rules out a second declaration.
    const valueImport = imports.find(
        n => n.importKind !== 'type' && isNamedOnly(n),
    )
    if (valueImport) {
        return fixer.insertTextAfter(
            valueImport.specifiers.at(-1),
            `, type ${alias}`,
        )
    }

    return insertImportDeclaration(
        fixer,
        program,
        `import type { ${alias} } from '${ALIAS_SOURCE}'`,
    )
}

// The rewrite keeps only the member's text, so a comment anywhere else in the union would be lost.
const dropsComment = (sourceCode, node, member) =>
    sourceCode
        .getCommentsInside(node)
        .some(c => c.range[0] < member.range[0] || c.range[1] > member.range[1])

export const preferNullableAlias = {
    meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
            description:
                'Write null and undefined unions with the Nullable, Optional and Maybe aliases from @perawallet/wallet-core-shared',
        },
        messages: {
            nullable:
                'Write Nullable<T> from @perawallet/wallet-core-shared instead of T | null.',
            optional:
                'Write Optional<T> from @perawallet/wallet-core-shared instead of T | undefined.',
            maybe: 'Write Maybe<T> from @perawallet/wallet-core-shared instead of T | null | undefined.',
        },
        schema: [],
    },
    create(context) {
        if (context.filename.endsWith('.d.ts')) return {}

        const { sourceCode } = context
        return {
            TSUnionType(node) {
                const match = matchNullableUnion(node)
                if (!match) return
                const { member, alias } = match

                const existing = findVariable(sourceCode.getScope(node), alias)
                const hasImport =
                    existing !== undefined && isSharedImport(existing)
                const isForeign = existing !== undefined && !hasImport
                const canFix =
                    !isForeign && !dropsComment(sourceCode, node, member)
                const replacement = `${alias}<${sourceCode.getText(member)}>`

                context.report({
                    node,
                    messageId: alias.toLowerCase(),
                    fix: canFix
                        ? fixer =>
                              hasImport
                                  ? fixer.replaceText(node, replacement)
                                  : [
                                        aliasImportFix(
                                            fixer,
                                            sourceCode.ast,
                                            alias,
                                        ),
                                        fixer.replaceText(node, replacement),
                                    ]
                        : null,
                })
            },
        }
    },
}
