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
import { useIsPeraCardEnabled } from '../useIsPeraCardEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: { enable_pera_card: 'enable_pera_card' },
}))

// Live getters so each test can flip the build-type flags the hook reads.
const buildFlags = vi.hoisted(() => ({ isDebug: false, isStaging: false }))
vi.mock('@perawallet/wallet-core-config', () => ({
    get isDebug() {
        return buildFlags.isDebug
    },
    get isStaging() {
        return buildFlags.isStaging
    },
}))

describe('useIsPeraCardEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        buildFlags.isDebug = false
        buildFlags.isStaging = false
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it('queries the enable_pera_card flag', () => {
        mockGetBooleanValue.mockReturnValue(true)

        renderHook(() => useIsPeraCardEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_pera_card',
            expect.any(Boolean),
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsPeraCardEnabled())
        expect(result.current).toBe(true)

        mockGetBooleanValue.mockReturnValue(false)
        const { result: result2 } = renderHook(() => useIsPeraCardEnabled())
        expect(result2.current).toBe(false)
    })

    it('falls back to visible on staging builds when the flag is unset', () => {
        // Mimic an unset remote value by echoing the fallback the hook passes.
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        buildFlags.isStaging = true

        const { result } = renderHook(() => useIsPeraCardEnabled())

        expect(result.current).toBe(true)
    })

    it('falls back to visible on debug builds when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        buildFlags.isDebug = true

        const { result } = renderHook(() => useIsPeraCardEnabled())

        expect(result.current).toBe(true)
    })

    it('falls back to hidden on the signed prod release when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )

        const { result } = renderHook(() => useIsPeraCardEnabled())

        expect(result.current).toBe(false)
    })
})
