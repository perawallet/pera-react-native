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

const SHARED_PACKAGE = '@perawallet/wallet-core-shared'
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self'])

const isFetchCallee = callee =>
    (callee.type === 'Identifier' && callee.name === 'fetch') ||
    (callee.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object.type === 'Identifier' &&
        GLOBAL_OBJECTS.has(callee.object.name) &&
        callee.property.name === 'fetch')

const isSignalKey = property =>
    property.type === 'Property' &&
    !property.computed &&
    ((property.key.type === 'Identifier' && property.key.name === 'signal') ||
        (property.key.type === 'Literal' && property.key.value === 'signal'))

// Only an object literal is judged; options built elsewhere are trusted.
const hasDeadlineOption = args =>
    args.some(arg => arg.type === 'SpreadElement') ||
    (args[1] !== undefined &&
        (args[1].type !== 'ObjectExpression' ||
            args[1].properties.some(
                property =>
                    property.type === 'SpreadElement' || isSignalKey(property),
            )))

const importedName = specifier =>
    specifier.imported.name ?? specifier.imported.value

export const fetchHasDeadline = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Give every fetch a deadline: an abort signal or the shared withTimeout',
        },
        messages: {
            missingDeadline:
                "fetch with no deadline can hang its flow forever: pass signal: AbortSignal.timeout(ms) (or the caller's signal), or wrap the call in withTimeout from @perawallet/wallet-core-shared.",
        },
        schema: [],
    },
    create(context) {
        const deadlineHelpers = new Set()

        // Climbs `.then(...)` / `.catch(...)` chains to the outermost call.
        const isWrapped = node => {
            let current = node
            while (
                current.parent &&
                ((current.parent.type === 'MemberExpression' &&
                    current.parent.object === current) ||
                    (current.parent.type === 'CallExpression' &&
                        current.parent.callee === current))
            ) {
                current = current.parent
            }
            const { parent } = current
            return (
                parent?.type === 'CallExpression' &&
                parent.arguments[0] === current &&
                parent.callee.type === 'Identifier' &&
                deadlineHelpers.has(parent.callee.name)
            )
        }

        return {
            ImportDeclaration(node) {
                if (node.source.value !== SHARED_PACKAGE) return
                for (const specifier of node.specifiers) {
                    if (
                        specifier.type === 'ImportSpecifier' &&
                        importedName(specifier) === 'withTimeout'
                    ) {
                        deadlineHelpers.add(specifier.local.name)
                    }
                }
            },
            CallExpression(node) {
                if (!isFetchCallee(node.callee)) return
                if (hasDeadlineOption(node.arguments)) return
                if (isWrapped(node)) return
                context.report({ node, messageId: 'missingDeadline' })
            },
        }
    },
}
