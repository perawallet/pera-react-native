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
import { config } from '@perawallet/wallet-core-config'
import { useIsQuantumSwapEnabled } from '../useIsQuantumSwapEnabled'

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfig: vi.fn(),
    RemoteConfigKeys: { enable_quantum_swap: 'enable_quantum_swap' },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { appEnvironment: 'production' },
}))

const { mockRouteCapabilities } = vi.hoisted(() => ({
    mockRouteCapabilities: { quantum: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockRouteCapabilities,
}))

describe('useIsQuantumSwapEnabled', () => {
    const mockGetBooleanValue = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        config.appEnvironment = 'production'
        mockRouteCapabilities.quantum = true
        ;(useRemoteConfig as Mock).mockReturnValue({
            getBooleanValue: mockGetBooleanValue,
        })
    })

    it('queries the enable_quantum_swap flag', () => {
        mockGetBooleanValue.mockReturnValue(true)

        renderHook(() => useIsQuantumSwapEnabled())

        expect(mockGetBooleanValue).toHaveBeenCalledWith(
            'enable_quantum_swap',
            expect.any(Boolean),
        )
    })

    it('returns the remote value when set', () => {
        mockGetBooleanValue.mockReturnValue(true)
        const { result } = renderHook(() => useIsQuantumSwapEnabled())
        expect(result.current).toBe(true)

        mockGetBooleanValue.mockReturnValue(false)
        const { result: result2 } = renderHook(() => useIsQuantumSwapEnabled())
        expect(result2.current).toBe(false)
    })

    it('falls back to enabled on staging when the flag is unset', () => {
        // Mimic an unset remote value by echoing the fallback the hook passes.
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        config.appEnvironment = 'staging'

        const { result } = renderHook(() => useIsQuantumSwapEnabled())

        expect(result.current).toBe(true)
    })

    it('falls back to disabled in production when the flag is unset', () => {
        mockGetBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        config.appEnvironment = 'production'

        const { result } = renderHook(() => useIsQuantumSwapEnabled())

        expect(result.current).toBe(false)
    })

    it('stays disabled when routeCapabilities.quantum is off, even if the remote flag is on', () => {
        mockGetBooleanValue.mockReturnValue(true)
        mockRouteCapabilities.quantum = false

        const { result } = renderHook(() => useIsQuantumSwapEnabled())

        expect(result.current).toBe(false)
    })
})
