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

const PACKAGE_SOURCE = /^@perawallet\//
const STORE_NAME = /^use[A-Z]\w*Store$/
const INTERNALS = new Set(['getState', 'setState'])

const propertyName = node => {
    if (!node.computed) {
        return node.property?.type === 'Identifier' ? node.property.name : null
    }
    const key = node.property
    return key?.type === 'Literal' && typeof key.value === 'string'
        ? key.value
        : null
}

// Packages expose behaviour through hooks and plain actions. Selector calls
// (`useXStore(s => ...)`) and `subscribe` are deliberately not covered.
export const noPackageStoreInternals = {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Don't call getState or setState on a Zustand store imported from a @perawallet package",
        },
        messages: {
            internals:
                "{{name}}.{{method}} reaches into a package's Zustand store: call the hook or action the package exports for this, adding one to the package if it has none.",
        },
        schema: [],
    },
    create(context) {
        // Local binding name of each package store, and of each namespace import.
        const stores = new Set()
        const namespaces = new Set()

        const nameOf = object => {
            if (object.type === 'Identifier') {
                return stores.has(object.name) ? object.name : null
            }
            if (
                object.type === 'MemberExpression' &&
                object.object.type === 'Identifier' &&
                namespaces.has(object.object.name)
            ) {
                const store = propertyName(object)
                return store !== null && STORE_NAME.test(store)
                    ? `${object.object.name}.${store}`
                    : null
            }
            return null
        }

        return {
            Program(program) {
                for (const node of program.body) {
                    if (
                        node.type !== 'ImportDeclaration' ||
                        node.importKind === 'type' ||
                        typeof node.source.value !== 'string' ||
                        !PACKAGE_SOURCE.test(node.source.value)
                    ) {
                        continue
                    }
                    for (const spec of node.specifiers) {
                        if (spec.importKind === 'type') continue
                        if (spec.type === 'ImportNamespaceSpecifier') {
                            namespaces.add(spec.local.name)
                        } else if (
                            spec.type === 'ImportSpecifier' &&
                            STORE_NAME.test(
                                spec.imported.name ?? spec.imported.value,
                            )
                        ) {
                            stores.add(spec.local.name)
                        }
                    }
                }
            },
            MemberExpression(node) {
                const method = propertyName(node)
                if (method === null || !INTERNALS.has(method)) return
                const name = nameOf(node.object)
                if (name === null) return
                context.report({
                    node,
                    messageId: 'internals',
                    data: { name, method },
                })
            },
        }
    },
}
