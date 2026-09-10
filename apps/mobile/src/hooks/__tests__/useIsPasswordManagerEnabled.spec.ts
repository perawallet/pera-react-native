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
import { useIsPasswordManagerEnabled } from '../useIsPasswordManagerEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: { enable_password_manager: 'enable_password_manager' },
}))

const { mockRouteCapabilities, mockBuildFlags } = vi.hoisted(() => ({
    mockRouteCapabilities: { passwordManager: true },
    mockBuildFlags: { isProd: false },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockRouteCapabilities,
}))

vi.mock('@perawallet/wallet-core-config', () => mockBuildFlags)

describe('useIsPasswordManagerEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteCapabilities.passwordManager = true
        mockBuildFlags.isProd = false
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it('queries the enable_password_manager flag with a hidden fallback', () => {
        mockGetBooleanValue.mockReturnValue(true)

        renderHook(() => useIsPasswordManagerEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_password_manager',
            false,
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsPasswordManagerEnabled())
        expect(result.current).toBe(true)

        mockGetBooleanValue.mockReturnValue(false)
        const { result: result2 } = renderHook(() =>
            useIsPasswordManagerEnabled(),
        )
        expect(result2.current).toBe(false)
    })

    it('stays disabled when routeCapabilities.passwordManager is off, even if the remote flag is on', () => {
        mockGetBooleanValue.mockReturnValue(true)
        mockRouteCapabilities.passwordManager = false

        const { result } = renderHook(() => useIsPasswordManagerEnabled())

        expect(result.current).toBe(false)
    })

    // Developer Settings and its Feature Flags overrides ship in production,
    // where the native credential provider is compiled out; the JS surface
    // must be just as unreachable there or a user could fill a keystore-only
    // vault nothing can ever autofill.
    it('stays disabled in a production build, even if the remote flag is on', () => {
        mockGetBooleanValue.mockReturnValue(true)
        mockBuildFlags.isProd = true

        const { result } = renderHook(() => useIsPasswordManagerEnabled())

        expect(result.current).toBe(false)
    })
})
