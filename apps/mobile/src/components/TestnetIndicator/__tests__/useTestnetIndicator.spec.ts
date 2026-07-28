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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { useTestnetIndicator } from '../useTestnetIndicator'

const mockNetworkState = vi.hoisted(() => ({
    network: 'mainnet' as Network,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({
        network: mockNetworkState.network,
        isMainnet: mockNetworkState.network === 'mainnet',
        isTestnet: mockNetworkState.network === 'testnet',
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const mockNetwork = (network: Network) => {
    mockNetworkState.network = network
}

describe('useTestnetIndicator', () => {
    it('is hidden on MainNet', () => {
        mockNetwork(Networks.mainnet)

        const { result } = renderHook(() => useTestnetIndicator())

        expect(result.current.isVisible).toBe(false)
    })

    it('is visible with the network label key on every non-mainnet network', () => {
        // Keys, not display text: every useLanguage mock in this codebase
        // (including this file's own pre-existing test) stubs `t` as the
        // identity function, so the resolved "label" a mocked hook test can
        // observe is the i18n key itself, not the localized string.
        const expected: Record<string, string> = {
            [Networks.testnet]: 'common.network_label.testnet',
            [Networks.betanet]: 'common.network_label.betanet',
            [Networks.fnet]: 'common.network_label.fnet',
            [Networks.localnet]: 'common.network_label.localnet',
        }

        for (const [network, label] of Object.entries(expected)) {
            mockNetwork(network as Network)

            const { result } = renderHook(() => useTestnetIndicator())

            expect(result.current.isVisible).toBe(true)
            expect(result.current.label).toBe(label)
        }
    })
})
