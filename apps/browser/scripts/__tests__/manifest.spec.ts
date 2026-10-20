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
            expect(() => toChromeVersion(version)).toThrow(/MAJOR.MINOR.PATCH/)
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

    it('leaves the source manifest comments out of the shipped one', () => {
        const stamped = stampManifest(
            {
                ...source,
                permissions: ['storage'],
                _comment_storage: 'Why storage is requested.',
            },
            { packageVersion: '1.4.2', appEnvironment: 'production' },
        )

        expect(Object.keys(stamped)).not.toContain('_comment_storage')
        expect(stamped.permissions).toEqual(['storage'])
    })

    it('keeps the pre-release tag in version_name', () => {
        const manifest = stampManifest(source, {
            packageVersion: '0.1.0-alpha.1',
            appEnvironment: 'production',
        })

        expect(manifest.version).toBe('0.1.0')
        expect(manifest.version_name).toBe('0.1.0-alpha.1')
    })

    it('prefers the CI version over package.json and appends the build number', () => {
        const manifest = stampManifest(source, {
            packageVersion: '0.1.0-alpha.1',
            appVersion: '7.2.0',
            buildNumber: '1234',
            appEnvironment: 'production',
        })

        expect(manifest.version).toBe('7.2.0.1234')
        expect(manifest.version_name).toBe('7.2.0')
    })

    it.each(['12a', '-1', '65536'])('rejects build number %j', buildNumber => {
        expect(() =>
            stampManifest(source, {
                packageVersion: '1.4.2',
                buildNumber,
                appEnvironment: 'production',
            }),
        ).toThrow(/BUILD_NUMBER/)
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
    const allOn = {
        WEB_INTEGRITY_MINT_ENABLED: true,
        WEB_INTEGRITY_BEARER_ENABLED: true,
        WEB_INTEGRITY_ENROL_ENABLED: true,
    }

    it('accepts a production build with the integrity token fully on', () => {
        expect(() =>
            assertReleaseEnv({
                appEnvironment: 'production',
                integrityFlags: allOn,
            }),
        ).not.toThrow()
    })

    it('fails a production build with any integrity flag off, naming it', () => {
        expect(() =>
            assertReleaseEnv({
                appEnvironment: 'production',
                integrityFlags: {
                    ...allOn,
                    WEB_INTEGRITY_ENROL_ENABLED: false,
                },
            }),
        ).toThrow(/WEB_INTEGRITY_ENROL_ENABLED/)
    })

    it('lets a development build run with the flags off', () => {
        expect(() =>
            assertReleaseEnv({
                appEnvironment: 'development',
                integrityFlags: {
                    WEB_INTEGRITY_MINT_ENABLED: false,
                    WEB_INTEGRITY_BEARER_ENABLED: false,
                    WEB_INTEGRITY_ENROL_ENABLED: false,
                },
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
