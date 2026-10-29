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

const isEntryPath = file =>
    GALLERY_ENTRY_PATHS.some(path =>
        path.endsWith('.ts') ? file === path : file.startsWith(`${path}/`),
    )

export const devGalleryEntryPoints = {
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
        const file = fromAppRoot(context.filename)
        if (isEntryPath(file)) return {}
        const check = (node, source) => {
            const specifier = staticSpecifier(source)
            if (specifier === undefined) return
            const target = specifier.startsWith('.')
                ? resolveSibling(file, specifier)
                : specifier
            if (!GALLERY_CODE.test(target)) return
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
