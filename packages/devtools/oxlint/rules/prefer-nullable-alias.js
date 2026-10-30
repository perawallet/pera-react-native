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

const ALIAS_HALVES = {
    Nullable: { hasNull: true, hasUndefined: false },
    Optional: { hasNull: false, hasUndefined: true },
    Maybe: { hasNull: true, hasUndefined: true },
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
    // Deliberately left as written: `readonly X[] | null` reads better than Nullable<readonly X[]>.
    if (member.type === 'TSTypeOperator' && member.operator === 'readonly') {
        return undefined
    }
    return {
        member,
        hasNull,
        hasUndefined,
        alias: aliasFor(hasNull, hasUndefined),
    }
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

// The shared alias a type reference names, or undefined when it is shadowed or foreign.
const sharedAliasOf = (sourceCode, node) => {
    if (node.type !== 'TSTypeReference') return undefined
    if (node.typeName.type !== 'Identifier') return undefined
    const { name } = node.typeName
    if (!Object.hasOwn(ALIAS_HALVES, name)) return undefined
    if (node.typeArguments?.params.length !== 1) return undefined
    const variable = findVariable(sourceCode.getScope(node), name)
    return variable !== undefined && isSharedImport(variable) ? name : undefined
}

// Optional<Nullable<T>> peels to T, collecting null and undefined on the way down.
const peelAliases = (sourceCode, node, halves) => {
    let { hasNull, hasUndefined } = halves
    const peeled = []
    let inner = node
    for (
        let alias = sharedAliasOf(sourceCode, inner);
        alias !== undefined;
        alias = sharedAliasOf(sourceCode, inner)
    ) {
        hasNull ||= ALIAS_HALVES[alias].hasNull
        hasUndefined ||= ALIAS_HALVES[alias].hasUndefined
        peeled.push(alias)
        inner = inner.typeArguments.params[0]
    }
    return { inner, peeled, alias: aliasFor(hasNull, hasUndefined) }
}

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

const removeDeclaration = (fixer, sourceCode, declaration) => {
    const end = declaration.range[1]
    const newline = sourceCode.text[end] === '\n' ? 1 : 0
    return fixer.removeRange([declaration.range[0], end + newline])
}

// One edit per declaration: separate removals of adjacent specifiers overlap, and oxlint drops every fix.
const rewriteImport = (fixer, sourceCode, declaration, textOf) => {
    const named = declaration.specifiers.filter(
        s => s.type === 'ImportSpecifier',
    )
    const kept = named.map(textOf).filter(text => text !== undefined)
    const last = named.at(-1)
    if (kept.length > 0) {
        return fixer.replaceTextRange(
            [named[0].range[0], last.range[1]],
            kept.join(', '),
        )
    }
    if (named.length === declaration.specifiers.length) {
        return removeDeclaration(fixer, sourceCode, declaration)
    }
    // `import Default, { … }` keeps the default and loses the braces.
    const closingBrace = sourceCode.text.indexOf('}', last.range[1]) + 1
    return fixer.removeRange([
        declaration.specifiers[0].range[1],
        closingBrace,
    ])
}

// Aliases the rewrite stops using, and that nothing outside `node` still reads.
const importsLeftUnused = (sourceCode, node, peeled, alias) => {
    const scope = sourceCode.getScope(node)
    const [start, end] = node.range
    return [...new Set(peeled)]
        .filter(name => name !== alias)
        .map(name => findVariable(scope, name))
        .filter(variable =>
            variable.references.every(
                ({ identifier: { range } }) =>
                    range[0] >= start && range[1] <= end,
            ),
        )
        .map(variable => variable.defs[0].node)
}

// Swaps the specifiers the collapse leaves unused for the alias it needs.
const collapseImportFixes = (fixer, sourceCode, unused, alias, hasImport) => {
    // Nothing is removed here, so the inserted specifier cannot overlap a removal.
    if (!hasImport && unused.length === 0) {
        return [aliasImportFix(fixer, sourceCode.ast, alias)]
    }
    const renamed = hasImport ? undefined : unused[0]
    const textOf = specifier => {
        if (specifier === renamed) {
            const prefix = specifier.importKind === 'type' ? 'type ' : ''
            return `${prefix}${alias}`
        }
        return unused.includes(specifier)
            ? undefined
            : sourceCode.getText(specifier)
    }
    return [...new Set(unused.map(specifier => specifier.parent))].map(
        declaration => rewriteImport(fixer, sourceCode, declaration, textOf),
    )
}

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
            collapse:
                'Write {{alias}}<T>: a nullable alias nested in another, or with null or undefined added, collapses to one.',
        },
        schema: [],
    },
    create(context) {
        if (context.filename.endsWith('.d.ts')) return {}

        const { sourceCode } = context

        const reportCollapse = (node, { inner, peeled, alias }) => {
            const existing = findVariable(sourceCode.getScope(node), alias)
            const hasImport = existing !== undefined && isSharedImport(existing)
            const isForeign = existing !== undefined && !hasImport
            const canFix = !isForeign && !dropsComment(sourceCode, node, inner)
            const replacement = `${alias}<${sourceCode.getText(inner)}>`

            context.report({
                node,
                messageId: 'collapse',
                data: { alias },
                fix: canFix
                    ? fixer => [
                          ...collapseImportFixes(
                              fixer,
                              sourceCode,
                              importsLeftUnused(
                                  sourceCode,
                                  node,
                                  peeled,
                                  alias,
                              ),
                              alias,
                              hasImport,
                          ),
                          fixer.replaceText(node, replacement),
                      ]
                    : null,
            })
        }

        // The outermost alias, or the nullable union around it, reports the whole chain.
        const isPeeledByParent = node => {
            const { parent } = node
            if (parent.type === 'TSTypeParameterInstantiation') {
                return sharedAliasOf(sourceCode, parent.parent) !== undefined
            }
            return (
                parent.type === 'TSUnionType' &&
                matchNullableUnion(parent)?.member === node
            )
        }

        return {
            TSTypeReference(node) {
                if (sharedAliasOf(sourceCode, node) === undefined) return
                if (isPeeledByParent(node)) return
                const collapsed = peelAliases(sourceCode, node, {
                    hasNull: false,
                    hasUndefined: false,
                })
                if (collapsed.peeled.length < 2) return
                reportCollapse(node, collapsed)
            },
            TSUnionType(node) {
                const match = matchNullableUnion(node)
                if (!match) return
                const { member, alias } = match

                const collapsed = peelAliases(sourceCode, member, match)
                if (collapsed.peeled.length > 0) {
                    reportCollapse(node, collapsed)
                    return
                }

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
