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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockCreateDevice = vi.fn()
const mockUpdateDevice = vi.fn()

vi.mock('../endpoints', () => ({
    createDevice: (...args: unknown[]) => mockCreateDevice(...args),
    updateDevice: (...args: unknown[]) => mockUpdateDevice(...args),
}))

const mockSetNetwork = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({
        network: 'mainnet',
    }),
    useNetworkStore: vi.fn(selector => {
        const state = { setNetwork: mockSetNetwork }
        return selector(state)
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

// Switching networks is a purely local concern: the store flips
// immediately — offline included — and device registration for the new
// network is owned by useDeviceRegistration, whose [addresses, network]
// effect re-fires on the store write and heals failures on reconnect /
// foreground (covered by useDeviceRegistration.test.ts).
describe('useSwitchNetwork', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('switches the store immediately without any backend call', async () => {
        vi.resetModules()
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('testnet')
        })

        expect(mockSetNetwork).toHaveBeenCalledWith('testnet')
        // No awaited device registration: an unreachable backend must never
        // block or revert the switch.
        expect(mockCreateDevice).not.toHaveBeenCalled()
        expect(mockUpdateDevice).not.toHaveBeenCalled()
    })

    test('no-ops when the target equals the current network', async () => {
        vi.resetModules()
        const { useSwitchNetwork } = await import('../useSwitchNetwork')

        const { result } = renderHook(() => useSwitchNetwork())

        await act(async () => {
            await result.current.switchNetwork('mainnet')
        })

        expect(mockSetNetwork).not.toHaveBeenCalled()
    })
})
