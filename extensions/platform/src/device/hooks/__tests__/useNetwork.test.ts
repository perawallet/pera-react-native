/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '../../../test-utils'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
        mainnetBackendUrl: 'https://mainnet-api.algorand.node',
        testnetBackendUrl: 'https://testnet-api.algorand.node',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
    isMainnet: vi.fn(network => network === 'mainnet'),
    isTestnet: vi.fn(network => network === 'testnet'),
    getNetworkConfig: vi.fn(network => ({
        algodUrl:
            network === 'mainnet'
                ? 'https://mainnet-algod.node'
                : 'https://testnet-algod.node',
    })),
}))

describe('device/hooks/useNetwork', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('should return current network and setter', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore } = await import('../../store')
        const { useNetwork } = await import('../useNetwork')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useNetwork())

        expect(result.current.network).toBe('mainnet')
        expect(typeof result.current.setNetwork).toBe('function')
    })

    test('should update network', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore } = await import('../../store')
        const { useNetwork } = await import('../useNetwork')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useNetwork())

        act(() => {
            result.current.setNetwork('testnet')
        })

        expect(result.current.network).toBe('testnet')
    })
})
