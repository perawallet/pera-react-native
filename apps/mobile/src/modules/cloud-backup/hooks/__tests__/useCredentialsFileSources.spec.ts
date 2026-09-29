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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

import {
    useCredentialsFileReadSources,
    useCredentialsFileSaveSources,
} from '../useCredentialsFileSources'

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-remote-config')
        >()
    return {
        ...actual,
        useRemoteConfig: vi.fn(),
    }
})

// Which sources a build has is the storage layer's answer (and is covered by
// its own spec); what this hook decides is which of them the flag lets through.
const { getSources } = vi.hoisted(() => ({ getSources: vi.fn() }))

vi.mock('../../storage', () => ({
    getCredentialsFileSaveSources: getSources,
    getCredentialsFileReadSources: getSources,
}))

const mockGetBooleanValue = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    getSources.mockReturnValue(['device', 'icloud', 'googleDrive'])
    ;(useRemoteConfig as Mock).mockReturnValue({
        getBooleanValue: mockGetBooleanValue,
        getStringValue: vi.fn(),
        getNumberValue: vi.fn(),
    })
})

describe.each([
    ['useCredentialsFileSaveSources', useCredentialsFileSaveSources],
    ['useCredentialsFileReadSources', useCredentialsFileReadSources],
])('%s', (_name, useSources) => {
    test('offers every source the build has when the flag is on', () => {
        mockGetBooleanValue.mockReturnValue(true)

        const { result } = renderHook(() => useSources())

        expect(result.current).toEqual(['device', 'icloud', 'googleDrive'])
    })

    test('leaves only local storage when the flag is off', () => {
        mockGetBooleanValue.mockReturnValue(false)

        const { result } = renderHook(() => useSources())

        expect(result.current).toEqual(['device'])
    })

    test('offers nothing on a build with no sources at all', () => {
        getSources.mockReturnValue([])
        mockGetBooleanValue.mockReturnValue(true)

        const { result } = renderHook(() => useSources())

        expect(result.current).toEqual([])
    })

    test('reads the flag with a false fallback', () => {
        mockGetBooleanValue.mockReturnValue(false)

        renderHook(() => useSources())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            RemoteConfigKeys.enable_backup_credentials_cloud_storage,
            false,
        )
    })
})
