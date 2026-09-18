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
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest'
import { renderHook } from '@testing-library/react'
import { Platform } from 'react-native'
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

const mockGetBooleanValue = vi.fn()
const originalOS = Platform.OS

beforeEach(() => {
    vi.clearAllMocks()
    ;(useRemoteConfig as Mock).mockReturnValue({
        getBooleanValue: mockGetBooleanValue,
        getStringValue: vi.fn(),
        getNumberValue: vi.fn(),
    })
})

afterEach(() => {
    Platform.OS = originalOS
})

describe('useCredentialsFileSaveSources', () => {
    test.each([
        ['ios', ['device', 'icloud', 'googleDrive']],
        ['android', ['device', 'googleDrive']],
    ] as const)(
        'offers every %s destination when the flag is on',
        (os, expected) => {
            Platform.OS = os
            mockGetBooleanValue.mockReturnValue(true)

            const { result } = renderHook(() => useCredentialsFileSaveSources())

            expect(result.current).toEqual(expected)
        },
    )

    test.each(['ios', 'android'] as const)(
        'leaves only local storage on %s when the flag is off',
        os => {
            Platform.OS = os
            mockGetBooleanValue.mockReturnValue(false)

            const { result } = renderHook(() => useCredentialsFileSaveSources())

            expect(result.current).toEqual(['device'])
        },
    )

    test('reads the flag with a false fallback', () => {
        mockGetBooleanValue.mockReturnValue(false)

        renderHook(() => useCredentialsFileSaveSources())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            RemoteConfigKeys.enable_backup_credentials_cloud_storage,
            false,
        )
    })
})

describe('useCredentialsFileReadSources', () => {
    test('offers every source the platform supports when the flag is on', () => {
        Platform.OS = 'ios'
        mockGetBooleanValue.mockReturnValue(true)

        const { result } = renderHook(() => useCredentialsFileReadSources())

        expect(result.current).toEqual(['device', 'icloud', 'googleDrive'])
    })

    test('leaves only the device when the flag is off', () => {
        Platform.OS = 'ios'
        mockGetBooleanValue.mockReturnValue(false)

        const { result } = renderHook(() => useCredentialsFileReadSources())

        expect(result.current).toEqual(['device'])
    })

    // The extension resolves the `.web` twin of credentialsFileSources, which
    // has its own spec; an unrecognised platform is offered nothing here.
    test('offers nothing on a platform with no sources', () => {
        Platform.OS = 'web'
        mockGetBooleanValue.mockReturnValue(true)

        const { result } = renderHook(() => useCredentialsFileReadSources())

        expect(result.current).toEqual([])
    })
})
