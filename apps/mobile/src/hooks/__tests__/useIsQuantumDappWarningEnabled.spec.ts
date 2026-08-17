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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useIsQuantumAccountsEnabled } from '../useIsQuantumAccountsEnabled'
import { useIsQuantumDappWarningEnabled } from '../useIsQuantumDappWarningEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: {
        enable_quantum_dapp_warning: 'enable_quantum_dapp_warning',
    },
}))

vi.mock('../useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: vi.fn(),
}))

describe('useIsQuantumDappWarningEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
        ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(true)
    })

    it('defaults to enabled when the remote value is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )

        const { result } = renderHook(() => useIsQuantumDappWarningEnabled())

        expect(result.current).toBe(true)
        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_quantum_dapp_warning',
            true,
        )
    })

    it('is disabled when the warning flag is turned off remotely', () => {
        mockGetBooleanValue.mockReturnValue(false)

        const { result } = renderHook(() => useIsQuantumDappWarningEnabled())

        expect(result.current).toBe(false)
    })

    it('is disabled when quantum accounts are disabled, even with the warning flag on', () => {
        mockGetBooleanValue.mockReturnValue(true)
        ;(useIsQuantumAccountsEnabled as Mock).mockReturnValue(false)

        const { result } = renderHook(() => useIsQuantumDappWarningEnabled())

        expect(result.current).toBe(false)
    })
})
