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
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
    DEVELOPER_GALLERY_MODULES,
    isDeveloperGalleryIncluded,
    readBakedAppEnvironment,
    toStubMap,
} from '../metro-build-gates'

const PROJECT_ROOT = path.resolve(__dirname, '..')

const writeGeneratedEnv = (body: string): string => {
    const file = path.join(
        mkdtempSync(path.join(tmpdir(), 'generated-env-')),
        'generated-env.ts',
    )
    writeFileSync(file, `export const generatedEnv = {\n${body}}\n`)
    return file
}

describe('readBakedAppEnvironment', () => {
    it('reads the channel generate-config.sh baked', () => {
        const file = writeGeneratedEnv(
            '  mainnetBackendUrl: "https://example.test",\n  appEnvironment: "production",\n',
        )

        expect(readBakedAppEnvironment(file)).toBe('production')
    })

    it('is undefined when APP_ENV was unset at generate time', () => {
        const file = writeGeneratedEnv('  releaseTag: "v1.0.0",\n')

        expect(readBakedAppEnvironment(file)).toBeUndefined()
    })

    it('is undefined when the file was never generated', () => {
        expect(
            readBakedAppEnvironment(path.join(tmpdir(), 'missing', 'env.ts')),
        ).toBeUndefined()
    })
})

describe('isDeveloperGalleryIncluded', () => {
    it.each([
        [undefined, undefined],
        ['development', undefined],
        ['staging', undefined],
        ['staging', 'staging'],
    ])('includes the gallery for baked=%s, APP_ENV=%s', (baked, appEnv) => {
        expect(
            isDeveloperGalleryIncluded({ bakedAppEnvironment: baked, appEnv }),
        ).toBe(true)
    })

    it.each([
        ['production', undefined],
        [undefined, 'production'],
        ['staging', 'production'],
        ['production', 'staging'],
    ])('excludes the gallery for baked=%s, APP_ENV=%s', (baked, appEnv) => {
        expect(
            isDeveloperGalleryIncluded({ bakedAppEnvironment: baked, appEnv }),
        ).toBe(false)
    })
})

describe('developer gallery stubs', () => {
    it('maps every gated module to an existing stub beside it', () => {
        const stubs = toStubMap(PROJECT_ROOT, DEVELOPER_GALLERY_MODULES)

        expect(Object.keys(stubs)).toHaveLength(
            DEVELOPER_GALLERY_MODULES.length,
        )
        for (const [real, stub] of Object.entries(stubs)) {
            expect(existsSync(real)).toBe(true)
            expect(stub).toBe(real.replace(/\.ts$/, '.stub.ts'))
            expect(existsSync(stub)).toBe(true)
        }
    })

    // The stubs only keep the gallery out of the bundle while nothing else
    // imports its screens or catalog at runtime. Type-only imports are erased
    // and don't count. The locale tour is exempt because metro.config.js
    // stubs it out of every non-dev bundle on its own gate.
    it('are the only runtime way into the gallery code', () => {
        const galleryImport =
            /^import\s+(?!type\b)[^']*?from\s+'[^']*screens\/developer\/(SettingsDeveloperGalleryScreen|GalleryCategoryScreen|GalleryComponentPreviewScreen|gallery-catalog)[^']*'/m
        const allowed = [
            'src/modules/settings/routes/developer-gallery.ts',
            'src/modules/settings/screens/developer/SettingsDeveloperGalleryScreen/',
            'src/modules/settings/screens/developer/GalleryCategoryScreen/',
            'src/modules/settings/screens/developer/GalleryComponentPreviewScreen/',
            'src/modules/settings/screens/developer/gallery-catalog/',
            'src/modules/locale-tour/',
        ]
        const sourceFiles = (
            readdirSync(path.join(PROJECT_ROOT, 'src'), {
                recursive: true,
            }) as string[]
        )
            .map(file => path.join('src', file))
            .filter(
                file =>
                    /\.tsx?$/.test(file) &&
                    !file.includes(`${path.sep}__tests__${path.sep}`),
            )

        const offenders = sourceFiles.filter(
            file =>
                !allowed.some(prefix => file.startsWith(prefix)) &&
                readFileSync(path.join(PROJECT_ROOT, file), 'utf8').search(
                    galleryImport,
                ) !== -1,
        )

        expect(offenders).toEqual([])
    })
})
