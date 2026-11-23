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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteConfigKeys } from '@perawallet/wallet-extension-platform'

const { getBooleanValueMock } = vi.hoisted(() => ({
    getBooleanValueMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        remoteConfig: { getBooleanValue: getBooleanValueMock },
    }),
}))

vi.mock('../readBooleanFlagBuildDefault', () => ({
    readBooleanFlagBuildDefault: vi.fn(() => false),
}))

vi.mock('../areConfigOverridesIgnored', () => ({
    areConfigOverridesIgnored: () => false,
}))

import { useRemoteConfigStore } from '../../store'
import { readBooleanFlagBuildDefault } from '../readBooleanFlagBuildDefault'
import { readBooleanFlagWithoutOverride } from '../readBooleanFlagWithoutOverride'

const KEY = RemoteConfigKeys.enable_device_registration_v4

describe('readBooleanFlagWithoutOverride', () => {
    beforeEach(() => {
        getBooleanValueMock.mockImplementation(
            (_key: string, fallback: boolean) => fallback,
        )
    })

    afterEach(() => {
        useRemoteConfigStore.setState({ configOverrides: {} })
    })

    it('asks the service with the build default as the fallback', () => {
        vi.mocked(readBooleanFlagBuildDefault).mockReturnValue(true)

        readBooleanFlagWithoutOverride(KEY)

        expect(getBooleanValueMock).toHaveBeenCalledWith(KEY, true)
    })

    it('shows the build default when Remote Config has no fetched value', () => {
        vi.mocked(readBooleanFlagBuildDefault).mockReturnValue(true)

        expect(readBooleanFlagWithoutOverride(KEY)).toBe(true)
    })

    it('shows a fetched true over a build default of false', () => {
        vi.mocked(readBooleanFlagBuildDefault).mockReturnValue(false)
        getBooleanValueMock.mockReturnValue(true)

        expect(readBooleanFlagWithoutOverride(KEY)).toBe(true)
    })

    it('ignores a saved developer override', () => {
        vi.mocked(readBooleanFlagBuildDefault).mockReturnValue(true)
        useRemoteConfigStore.setState({ configOverrides: { [KEY]: false } })

        expect(readBooleanFlagWithoutOverride(KEY)).toBe(true)
    })
})
