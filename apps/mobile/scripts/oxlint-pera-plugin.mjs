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

// Build-time config (`config.supportBaseUrl`, `config.x.y`) is trusted; any
// other non-constant argument may be peer-, backend- or metadata-supplied.
const isConfigMember = node => {
    let current = node
    while (current.type === 'MemberExpression') current = current.object
    return current.type === 'Identifier' && current.name === 'config'
}

const isTrustedArgument = node =>
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' && node.expressions.length === 0) ||
    (node.type === 'MemberExpression' && isConfigMember(node))

const isLinkingOpenUrl = callee =>
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Linking' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'openURL'

const noUnvalidatedOpenUrl = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Route non-constant URLs through openValidatedBrowserUrl before Linking.openURL',
        },
        messages: {
            unvalidated:
                "Linking.openURL with a non-constant URL: use openValidatedBrowserUrl (react-native-web resolves a relative string against the extension page), or disable with a '-- reason' naming where this URL was validated.",
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                if (!isLinkingOpenUrl(node.callee)) return
                const [argument] = node.arguments
                if (argument && isTrustedArgument(argument)) return
                context.report({ node, messageId: 'unvalidated' })
            },
        }
    },
}

// Digits, whitespace and punctuation alone are not copy.
const NOT_COPY = /^[0-9\s!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/
// A prop whose name ends in one of these carries user-facing copy.
const COPY_PROP = /(title|body|placeholder|label)$/

const noHardcodedUiStrings = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Render user-facing copy through t() rather than hardcoding it',
        },
        messages: {
            text: '"{{text}}" is hardcoded in <Text>: move it into en.json and render it with t().',
            prop: '{{name}}="{{text}}" is hardcoded: move it into en.json and render it with t().',
        },
        schema: [],
    },
    create(context) {
        return {
            JSXElement(node) {
                const { name } = node.openingElement
                if (name.type !== 'JSXIdentifier' || name.name !== 'Text') return
                if (
                    node.children.length === 0 ||
                    node.children.some(child => child.type !== 'JSXText')
                ) {
                    return
                }
                const text = node.children
                    .map(child => child.value)
                    .join('')
                    .trim()
                if (NOT_COPY.test(text)) return
                context.report({ node, messageId: 'text', data: { text } })
            },
            JSXAttribute(node) {
                if (node.name.type !== 'JSXIdentifier') return
                const name = node.name.name
                if (!COPY_PROP.test(name)) return
                if (
                    node.value?.type !== 'Literal' ||
                    typeof node.value.value !== 'string'
                ) {
                    return
                }
                const text = node.value.value.trim()
                if (text === '' || /['"{}]/.test(text) || NOT_COPY.test(text)) {
                    return
                }
                context.report({ node, messageId: 'prop', data: { name, text } })
            },
        }
    },
}

// Gallery screens reach the app only through their route entry, which
// metro.config.js stubs out of production builds; the locale tour is stubbed
// out of non-dev bundles on its own gate. Paths are relative to apps/mobile.
export const GALLERY_ENTRY_PATHS = [
    'src/modules/settings/routes/developer-gallery.ts',
    'src/modules/settings/screens/developer/SettingsDeveloperGalleryScreen',
    'src/modules/settings/screens/developer/GalleryCategoryScreen',
    'src/modules/settings/screens/developer/GalleryComponentPreviewScreen',
    'src/modules/settings/screens/developer/gallery-catalog',
    'src/modules/locale-tour',
]

const GALLERY_CODE =
    /screens\/developer\/(?:SettingsDeveloperGalleryScreen|GalleryCategoryScreen|GalleryComponentPreviewScreen|gallery-catalog)/

// context.filename is absolute or already relative to apps/mobile,
// depending on how oxlint is invoked.
const fromAppRoot = filename => {
    const at = filename.lastIndexOf('/apps/mobile/')
    return at === -1 ? filename : filename.slice(at + '/apps/mobile/'.length)
}

const isEntryPath = file =>
    GALLERY_ENTRY_PATHS.some(path =>
        path.endsWith('.ts') ? file === path : file.startsWith(`${path}/`),
    )

// A string literal, or a template without interpolation.
const staticSpecifier = node => {
    if (node?.type === 'Literal' && typeof node.value === 'string') {
        return node.value
    }
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0]?.value.cooked
    }
    return undefined
}

const devGalleryEntryPoints = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Import developer-gallery code only through its route entry',
        },
        messages: {
            gallery:
                '{{specifier}} is gallery code: import it only through modules/settings/routes/developer-gallery.ts, which production builds stub out. A type-only import is fine.',
        },
        schema: [],
    },
    create(context) {
        if (isEntryPath(fromAppRoot(context.filename))) return {}
        const check = (node, source) => {
            const specifier = staticSpecifier(source)
            if (specifier === undefined || !GALLERY_CODE.test(specifier)) return
            context.report({ node, messageId: 'gallery', data: { specifier } })
        }
        return {
            ImportDeclaration(node) {
                if (node.importKind !== 'type') check(node, node.source)
            },
            ExportNamedDeclaration(node) {
                if (node.source && node.exportKind !== 'type') {
                    check(node, node.source)
                }
            },
            ExportAllDeclaration(node) {
                if (node.exportKind !== 'type') check(node, node.source)
            },
            ImportExpression(node) {
                check(node, node.source)
            },
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'require'
                ) {
                    check(node, node.arguments[0])
                }
            },
        }
    },
}

/** Everything a dApp sign request flows through, relative to the repo root. */
export const DAPP_SIGNING_PATHS = [
    'packages/signing/src/pipeline',
    'packages/signing/src/machine',
    'packages/signing/src/hooks/useSignAndSubmitGroup.ts',
    'packages/signing/src/hooks/useSigningRequest.ts',
    'packages/signing/src/hooks/useSigningPipeline.ts',
]

// Word-bounded so cosignProgrammatic and friends stay legal. Raw text, as the
// spec this replaces scanned it: a comment naming the signer is flagged too.
const PROGRAM_SIGNER =
    /\b(?:useProgramSigner|signProgram|signDelegatedLsig|encodeDelegatedLsig|ProgramSigningUnsupportedError)\b/g

const lineColumn = (text, index) => {
    const before = text.slice(0, index)
    return {
        line: before.split('\n').length,
        column: index - (before.lastIndexOf('\n') + 1),
    }
}

const noProgramSignerInDappPaths = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Keep the delegated LogicSig signer unreachable from dApp signing',
        },
        messages: {
            reachable:
                '{{name}} must not be reachable from dApp signing: dApp requests resolve signers only through getSigningStrategy.',
        },
        schema: [],
    },
    create(context) {
        return {
            Program() {
                const text = context.sourceCode.getText()
                for (const match of text.matchAll(PROGRAM_SIGNER)) {
                    context.report({
                        loc: {
                            start: lineColumn(text, match.index),
                            end: lineColumn(text, match.index + match[0].length),
                        },
                        messageId: 'reachable',
                        data: { name: match[0] },
                    })
                }
            },
        }
    },
}

export default {
    meta: { name: 'pera' },
    rules: {
        'no-unvalidated-open-url': noUnvalidatedOpenUrl,
        'no-hardcoded-ui-strings': noHardcodedUiStrings,
        'dev-gallery-entry-points': devGalleryEntryPoints,
        'no-program-signer-in-dapp-paths': noProgramSignerInDappPaths,
    },
}
