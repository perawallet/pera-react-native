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

import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'
import { useIsCloudBackupEnabled } from '../useIsCloudBackupEnabled'

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

beforeEach(() => {
    vi.clearAllMocks()
    ;(useRemoteConfig as Mock).mockReturnValue({
        getBooleanValue: mockGetBooleanValue,
        getStringValue: vi.fn(),
        getNumberValue: vi.fn(),
    })
})

describe('useIsCloudBackupEnabled', () => {
    test('reads the enable_cloud_backup flag, defaulting to false', () => {
        mockGetBooleanValue.mockReturnValue(false)

        const { result } = renderHook(() => useIsCloudBackupEnabled())

        expect(result.current).toBe(false)
        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            RemoteConfigKeys.enable_cloud_backup,
            false,
        )
    })

    test('returns true when the flag is enabled', () => {
        mockGetBooleanValue.mockReturnValue(true)

        const { result } = renderHook(() => useIsCloudBackupEnabled())

        expect(result.current).toBe(true)
    })
})
