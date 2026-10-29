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

// The platform twins are real: Metro resolves './styles' to styles.web.ts, and
// web-only components have nothing else. context.filename is absolute or
// relative to apps/mobile depending on how oxlint is invoked.
const STYLES_FILE = /(?:^|[\\/])styles(?:\.(?:web|ios|android|native))?\.ts$/

const importedName = specifier =>
    specifier.imported.name ?? specifier.imported.value

export const makeStylesLocation = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Call makeStyles only in the styles.ts beside the component',
        },
        messages: {
            location:
                "makeStyles belongs in the styles.ts beside the code that uses it (styles.web.ts for a web-only one): move this call there, export it as useStyles for the folder's main component or use<Name>Styles for any other, and import it from './styles'.",
        },
        schema: [],
    },
    create(context) {
        if (STYLES_FILE.test(context.filename)) return {}
        const bindings = new Set()
        return {
            ImportDeclaration(node) {
                if (node.importKind === 'type') return
                if (node.source.value !== '@rneui/themed') return
                for (const specifier of node.specifiers) {
                    if (
                        specifier.type === 'ImportSpecifier' &&
                        specifier.importKind !== 'type' &&
                        importedName(specifier) === 'makeStyles'
                    ) {
                        bindings.add(specifier.local.name)
                    }
                }
            },
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    bindings.has(node.callee.name)
                ) {
                    context.report({ node, messageId: 'location' })
                }
            },
        }
    },
}
