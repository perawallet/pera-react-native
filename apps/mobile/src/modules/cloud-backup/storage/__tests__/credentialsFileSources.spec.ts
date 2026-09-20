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

const sourcesOn = async (os: string) => {
    vi.resetModules()
    vi.spyOn(Platform, 'OS', 'get').mockReturnValue(os as typeof Platform.OS)
    return import('../credentialsFileSources')
}

afterEach(() => vi.restoreAllMocks())

describe('credentials file sources', () => {
    test('offers iCloud only on iOS, which is the only platform with a client', async () => {
        const { getCredentialsFileSaveSources } = await sourcesOn('ios')

        expect(getCredentialsFileSaveSources()).toEqual([
            'device',
            'icloud',
            'googleDrive',
        ])
    })

    test('drops iCloud on Android', async () => {
        const { getCredentialsFileSaveSources } = await sourcesOn('android')

        expect(getCredentialsFileSaveSources()).toEqual([
            'device',
            'googleDrive',
        ])
    })

    // Neither native SDK ships outside the two mobile builds, so a source list
    // must never leak a row that would throw the moment it is tapped.
    test('offers nothing on a platform with neither SDK', async () => {
        const { getCredentialsFileSaveSources, getCredentialsFileReadSources } =
            await sourcesOn('windows')

        expect(getCredentialsFileSaveSources()).toEqual([])
        expect(getCredentialsFileReadSources()).toEqual([])
    })

    test.each(['ios', 'android'])(
        'reads from the same places it saves to on %s',
        async os => {
            const {
                getCredentialsFileSaveSources,
                getCredentialsFileReadSources,
            } = await sourcesOn(os)

            expect(getCredentialsFileReadSources()).toEqual(
                getCredentialsFileSaveSources(),
            )
        },
    )
})
