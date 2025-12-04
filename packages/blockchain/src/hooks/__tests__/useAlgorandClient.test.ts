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

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAlgorandClient } from '../../hooks'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'

// Mock AlgorandClient factory methods so we can assert which one is chosen
vi.mock('@algorandfoundation/algokit-utils', () => {
    return {
        AlgorandClient: {
            testNet: vi.fn(() => 'TESTNET_CLIENT'),
            mainNet: vi.fn(() => 'MAINNET_CLIENT'),
            fromEnvironment: vi.fn(() => 'ENV_CLIENT'),
            fromConfig: vi.fn(() => 'FROM_CONFIG_CLIENT'),
        },
    }
})

// Mock useNetwork from platform-integration
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(),
}))

describe('services/blockchain/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })
    })

    test('returns fromConfig client for mainnet', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })
        const { result } = renderHook(() => useAlgorandClient())

        expect(AlgorandClient.fromConfig).toHaveBeenCalledTimes(1)
        expect(AlgorandClient.testNet).not.toHaveBeenCalled()
        expect(AlgorandClient.mainNet).not.toHaveBeenCalled()
        expect(AlgorandClient.fromEnvironment).not.toHaveBeenCalled()
        expect(result.current).toBe('FROM_CONFIG_CLIENT')
    })

    test('returns fromConfig client for testnet', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'testnet' })
        const { result } = renderHook(() => useAlgorandClient())

        expect(AlgorandClient.fromConfig).toHaveBeenCalledTimes(1)
        expect(AlgorandClient.testNet).not.toHaveBeenCalled()
        expect(AlgorandClient.mainNet).not.toHaveBeenCalled()
        expect(AlgorandClient.fromEnvironment).not.toHaveBeenCalled()
        expect(result.current).toBe('FROM_CONFIG_CLIENT')
    })

    test('returns fromConfig client for unknown network', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'devnet' })
        const { result } = renderHook(() => useAlgorandClient())

        expect(AlgorandClient.fromConfig).toHaveBeenCalledTimes(1)
        expect(AlgorandClient.testNet).not.toHaveBeenCalled()
        expect(AlgorandClient.mainNet).not.toHaveBeenCalled()
        expect(AlgorandClient.fromEnvironment).not.toHaveBeenCalled()
        expect(result.current).toBe('FROM_CONFIG_CLIENT')
    })
})
