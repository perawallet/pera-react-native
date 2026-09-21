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

import { afterEach, describe, expect, test, vi } from 'vitest'
import { Platform } from 'react-native'
import type { CloudFileStore } from '@perawallet/wallet-extension-platform'

const { getAvailableStores } = vi.hoisted(() => ({
    getAvailableStores: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ cloudFileStorage: { getAvailableStores } }),
}))

const sourcesOn = async (os: string, stores: CloudFileStore[] = []) => {
    vi.resetModules()
    vi.spyOn(Platform, 'OS', 'get').mockReturnValue(os as typeof Platform.OS)
    getAvailableStores.mockClear().mockReturnValue(stores)
    return import('../credentialsFileSources')
}

afterEach(() => vi.restoreAllMocks())

describe('credentials file sources', () => {
    test('lists the local file first, then the drives the platform reports', async () => {
        const { getCredentialsFileSaveSources } = await sourcesOn('ios', [
            'icloud',
            'googleDrive',
        ])

        expect(getCredentialsFileSaveSources()).toEqual([
            'device',
            'icloud',
            'googleDrive',
        ])
    })

    test('offers the local file alone when the platform reports no drive', async () => {
        const { getCredentialsFileSaveSources } = await sourcesOn('android', [])

        expect(getCredentialsFileSaveSources()).toEqual(['device'])
    })

    // Nothing here ships outside the two mobile builds, so a source list must
    // never leak a row that would throw the moment it is tapped.
    test('offers nothing on a platform with neither the picker nor an SDK', async () => {
        const { getCredentialsFileSaveSources, getCredentialsFileReadSources } =
            await sourcesOn('windows', ['icloud', 'googleDrive'])

        expect(getCredentialsFileSaveSources()).toEqual([])
        expect(getCredentialsFileReadSources()).toEqual([])
    })

    test.each(['ios', 'android'])(
        'reads from the same places it saves to on %s',
        async os => {
            const {
                getCredentialsFileSaveSources,
                getCredentialsFileReadSources,
            } = await sourcesOn(os, ['googleDrive'])

            expect(getCredentialsFileReadSources()).toEqual(
                getCredentialsFileSaveSources(),
            )
        },
    )

    // Callers memoize on this array's identity, so a fresh one per call would
    // make every dependent `useMemo` miss.
    test('hands back the same array each call, and asks the platform once', async () => {
        const { getCredentialsFileSaveSources, getCredentialsFileReadSources } =
            await sourcesOn('ios', ['icloud'])

        expect(getCredentialsFileSaveSources()).toBe(
            getCredentialsFileReadSources(),
        )
        expect(getAvailableStores).toHaveBeenCalledTimes(1)
    })
})
