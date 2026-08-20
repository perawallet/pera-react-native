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
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { render, screen } from '@test-utils/render'
import { TestnetIndicator } from '../TestnetIndicator.web'

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

describe('TestnetIndicator', () => {
    it('renders the label bar and the frame accents off MainNet', () => {
        mockNetworkState.network = Networks.testnet

        render(<TestnetIndicator />)

        expect(screen.getByTestId('testnet_indicator')).toBeTruthy()
        expect(screen.getByTestId('testnet_indicator_frame')).toBeTruthy()
        // The test harness resolves i18n keys, not localized strings.
        expect(screen.getByText('common.network_label.testnet')).toBeTruthy()
    })

    it('renders nothing on MainNet', () => {
        mockNetworkState.network = Networks.mainnet

        render(<TestnetIndicator />)

        expect(screen.queryByTestId('testnet_indicator')).toBeNull()
        expect(screen.queryByTestId('testnet_indicator_frame')).toBeNull()
    })
})
