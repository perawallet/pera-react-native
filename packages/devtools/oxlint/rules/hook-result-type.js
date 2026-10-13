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

/** Types that hand a caller the raw TanStack Query or zustand object. */
export const LEAKY_RESULT_TYPES = [
    'UseQueryResult',
    'UseMutationResult',
    'UseInfiniteQueryResult',
    'UseSuspenseQueryResult',
    'StoreApi',
]

// Every type name an annotation references, however nested: unions,
// generics, arrays and object types all hide a reference somewhere.
const referencedTypeNames = root => {
    const names = []
    const visit = value => {
        if (Array.isArray(value)) {
            value.forEach(visit)
            return
        }
        if (value === null || typeof value !== 'object') return
        if (value.type === 'TSTypeReference') {
            const { typeName } = value
            const name =
                typeName.type === 'Identifier'
                    ? typeName.name
                    : typeName.right?.name
            if (name !== undefined) names.push(name)
        }
        for (const key of Object.keys(value)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue
            visit(value[key])
        }
    }
    visit(root)
    return names
}

export const hookResultType = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Exported hooks declare their own result type rather than returning the raw query or store',
        },
        messages: {
            leak: '{{hook}} returns {{type}}: declare a Use…Result type with safe defaults (data ?? []) instead of handing callers the raw query or store.',
        },
        schema: [],
    },
    create(context) {
        const check = (name, annotations) => {
            if (!/^use[A-Z]/.test(name)) return
            for (const annotation of annotations) {
                if (!annotation) continue
                const leaked = referencedTypeNames(annotation).find(type =>
                    LEAKY_RESULT_TYPES.includes(type),
                )
                if (leaked !== undefined) {
                    context.report({
                        node: annotation,
                        messageId: 'leak',
                        data: { hook: name, type: leaked },
                    })
                    return
                }
            }
        }
        return {
            ExportNamedDeclaration(node) {
                const declaration = node.declaration
                if (!declaration) return
                if (
                    declaration.type === 'FunctionDeclaration' &&
                    declaration.id
                ) {
                    check(declaration.id.name, [declaration.returnType])
                    return
                }
                if (declaration.type !== 'VariableDeclaration') return
                for (const declarator of declaration.declarations) {
                    const init = declarator.init
                    // A zustand store is a variable typed
                    // UseBoundStore<StoreApi<…>>, not a function returning one.
                    if (
                        declarator.id.type !== 'Identifier' ||
                        (init?.type !== 'ArrowFunctionExpression' &&
                            init?.type !== 'FunctionExpression')
                    ) {
                        continue
                    }
                    check(declarator.id.name, [
                        init.returnType,
                        declarator.id.typeAnnotation,
                    ])
                }
            },
        }
    },
}
