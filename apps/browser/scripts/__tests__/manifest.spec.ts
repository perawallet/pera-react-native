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

import { describe, expect, it } from 'vitest'

import {
    assertReleaseEnv,
    assertStampedManifest,
    stampManifest,
    toChromeVersion,
} from '../manifest.mjs'

const source = { name: 'Pera Wallet', description: 'Algorand wallet by Pera' }

describe('toChromeVersion', () => {
    it('keeps a plain release version', () => {
        expect(toChromeVersion('1.4.2')).toBe('1.4.2')
    })

    it('drops a pre-release tag Chrome cannot parse', () => {
        expect(toChromeVersion('0.1.0-alpha.1')).toBe('0.1.0')
    })

    it.each(['1.4', '1.4.2.7', '01.4.2', '1.70000.0', 'v1.4.2', ''])(
        'rejects %j',
        version => {
            expect(() => toChromeVersion(version)).toThrow(/package.json/)
        },
    )
})

describe('stampManifest', () => {
    it('stamps a production build with the bare description', () => {
        expect(
            stampManifest(source, {
                packageVersion: '1.4.2',
                appEnvironment: 'production',
            }),
        ).toEqual({ ...source, version: '1.4.2' })
    })

    it('keeps the pre-release tag in version_name', () => {
        const manifest = stampManifest(source, {
            packageVersion: '0.1.0-alpha.1',
            appEnvironment: 'production',
        })

        expect(manifest.version).toBe('0.1.0')
        expect(manifest.version_name).toBe('0.1.0-alpha.1')
    })

    it.each([
        ['development', 'Algorand wallet by Pera (development build)'],
        ['staging', 'Algorand wallet by Pera (staging build)'],
    ])('labels a %s build', (appEnvironment, description) => {
        expect(
            stampManifest(source, { packageVersion: '1.4.2', appEnvironment })
                .description,
        ).toBe(description)
    })
})

describe('assertReleaseEnv', () => {
    it('fails a production build without a backend API key', () => {
        expect(() =>
            assertReleaseEnv({
                appEnvironment: 'production',
                hasBackendApiKey: false,
            }),
        ).toThrow(/BACKEND_API_KEY/)
    })

    it('lets a development build run without one', () => {
        expect(() =>
            assertReleaseEnv({
                appEnvironment: 'development',
                hasBackendApiKey: false,
            }),
        ).not.toThrow()
    })
})

describe('assertStampedManifest', () => {
    it('fails a production manifest still labelled as a development build', () => {
        expect(() =>
            assertStampedManifest(
                { description: 'Algorand wallet by Pera (development build)' },
                { appEnvironment: 'production' },
            ),
        ).toThrow(/production manifest description/)
    })

    it('accepts the stamped production manifest', () => {
        const manifest = stampManifest(source, {
            packageVersion: '1.4.2',
            appEnvironment: 'production',
        })

        expect(() =>
            assertStampedManifest(manifest, { appEnvironment: 'production' }),
        ).not.toThrow()
    })
})
