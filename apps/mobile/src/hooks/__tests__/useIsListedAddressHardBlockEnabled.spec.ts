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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useIsListedAddressHardBlockEnabled } from '../useIsListedAddressHardBlockEnabled'

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-remote-config')
    >()),
    useRemoteConfig: vi.fn(),
}))

const mockGetBooleanValue = vi.fn()

describe('useIsListedAddressHardBlockEnabled', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it.each([true, false])('returns the remote value %s when set', value => {
        mockGetBooleanValue.mockReturnValue(value)

        const { result } = renderHook(() =>
            useIsListedAddressHardBlockEnabled(),
        )

        expect(result.current).toBe(value)
    })

    it('defaults to on when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback,
        )

        const { result } = renderHook(() =>
            useIsListedAddressHardBlockEnabled(),
        )

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_listed_address_hard_block',
            true,
        )
        expect(result.current).toBe(true)
    })
})
