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
import { AssetIconWithNetwork } from '../AssetIconWithNetwork'

const USDC = { assetId: '0xusdc', name: 'USD Coin', unitName: 'USDC' }

describe('AssetIconWithNetwork', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it("pins the icon of a chain the wallet runs to the asset's icon", () => {
        render(
            <AssetIconWithNetwork
                asset={USDC}
                chainId='ethereum'
                networkChainId='ethereum'
            />,
        )

        expect(screen.getByTestId('chain_avatar_badge_ethereum')).toBeTruthy()
    })

    it("draws a network the wallet doesn't run from its logo", () => {
        render(
            <AssetIconWithNetwork
                asset={USDC}
                chainId={null}
                networkLogoUrl='https://logo.test/solana.png'
                networkLogoTestID='network_logo'
            />,
        )

        expect(screen.getByTestId('network_logo')).toBeTruthy()
    })

    it("prefers the wallet's own chain icon over a logo", () => {
        render(
            <AssetIconWithNetwork
                asset={USDC}
                chainId='ethereum'
                networkChainId='ethereum'
                networkLogoUrl='https://logo.test/eth-coin.png'
                networkLogoTestID='network_logo'
            />,
        )

        expect(screen.getByTestId('chain_avatar_badge_ethereum')).toBeTruthy()
        expect(screen.queryByTestId('network_logo')).toBeNull()
    })

    it('draws no badge when no network is given', () => {
        render(
            <AssetIconWithNetwork
                asset={USDC}
                chainId='ethereum'
            />,
        )

        expect(screen.queryByTestId(/^chain_avatar_badge_/)).toBeNull()
    })
})
