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

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    devGalleryEntryPoints,
    GALLERY_ENTRY_PATHS,
} from '../rules/dev-gallery-entry-points.js'
import type { Node } from './helpers.js'

// The rule's paths are relative to apps/mobile, so gallery-paths-exist
// resolves there rather than from the repo root.
const mobileRoot = join(__dirname, '../../../../apps/mobile')

describe('pera/dev-gallery-entry-points', () => {
    const lintIn = (file: string, visitor: string, node: Node) => {
        const report = vi.fn()
        const visitors: Partial<Record<string, (node: Node) => void>> =
            devGalleryEntryPoints.create({
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
        expect(existsSync(join(mobileRoot, path))).toBe(true)
    })
})
