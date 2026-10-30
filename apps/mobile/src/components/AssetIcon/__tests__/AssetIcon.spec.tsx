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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@test-utils/render'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { AssetIcon } from '../AssetIcon'

describe('AssetIcon', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('draws the native icon for ALGO on Algorand', () => {
        render(
            <AssetIcon
                asset={{ assetId: '0', name: 'Algo', unitName: 'ALGO' }}
                chainId={LEGACY_CHAIN_ID}
                testID='icon'
            />,
        )

        expect(screen.getByTestId('icon')).toBeTruthy()
        expect(screen.queryByText('A')).toBeNull()
    })

    it('draws the native icon for ETH on Ethereum', () => {
        render(
            <AssetIcon
                asset={{ assetId: 'native', name: 'Ether', unitName: 'ETH' }}
                chainId='ethereum'
                testID='icon'
            />,
        )

        expect(screen.getByTestId('icon')).toBeTruthy()
        expect(screen.queryByText('E')).toBeNull()
    })

    it("draws initials, not the Algo icon, for Algorand's native id on an EVM chain", () => {
        render(
            <AssetIcon
                asset={{ assetId: '0', unitName: 'ZRO' }}
                chainId='ethereum'
                testID='icon'
            />,
        )

        expect(screen.queryByTestId('icon')).toBeNull()
        expect(screen.getByText('Z')).toBeTruthy()
    })

    it('draws a native-id asset as a token when it has no chain', () => {
        render(
            <AssetIcon
                asset={{ assetId: '0', unitName: 'ALGO' }}
                chainId={null}
                testID='icon'
            />,
        )

        expect(screen.queryByTestId('icon')).toBeNull()
        expect(screen.getByText('A')).toBeTruthy()
    })
})
