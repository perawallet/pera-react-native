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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import {
    resolveEthereumAssetAbout,
    resolveEthereumAssetSupply,
} from '../chain-ui'

const ethereum = evmChainOf('ethereum')
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const paramsFor = (assetId: string, totalSupply = new Decimal(0)) => ({
    asset: { assetId, decimals: 6, totalSupply } as PeraAsset,
    scope: { chainId: 'ethereum', networkId: 'mainnet' } as const,
    descriptor: ethereum.descriptor,
    isNativeAsset: assetId === 'native',
})

describe('resolveEthereumAssetAbout', () => {
    it("gives the native coin no id row and the explorer's front page", () => {
        const about = resolveEthereumAssetAbout(paramsFor('native'))

        expect(about.idLabelKey).toBeNull()
        expect(about.explorerLink).toEqual({
            url: 'https://etherscan.io',
            label: 'etherscan.io',
        })
    })

    it('has no explorer link for the native coin on a network with no explorer', () => {
        const about = resolveEthereumAssetAbout({
            ...paramsFor('native'),
            scope: { chainId: 'ethereum', networkId: 'custom' },
        })

        expect(about.explorerLink).toBeNull()
    })

    it('labels a token by its contract and links its explorer page', () => {
        const about = resolveEthereumAssetAbout(paramsFor(USDC))

        expect(about.idLabelKey).toBe('asset_details.collectible.contract')
        expect(about.explorerLink).toEqual({
            url: `https://etherscan.io/token/${USDC}`,
            label: 'etherscan.io',
        })
    })
})

describe('resolveEthereumAssetSupply', () => {
    it('calls the native coin circulating supply and has no figure for it', () => {
        expect(resolveEthereumAssetSupply(paramsFor('native'))).toEqual({
            labelKey: 'asset_details.markets.circulating_supply',
            infoBodyKey: 'asset_details.markets.circulating_supply_info_body',
            amount: null,
        })
    })

    it('shows a token its total supply under the token copy', () => {
        const display = resolveEthereumAssetSupply(
            paramsFor(USDC, new Decimal('61234567890000000')),
        )

        expect(display.labelKey).toBe('asset_details.markets.total_supply')
        expect(display.infoBodyKey).toBe(
            'asset_details.markets.token_total_supply_info_body',
        )
        expect(display.amount?.toFixed()).toBe('61234567890000000')
    })

    it('has no figure for a token whose supply is unknown', () => {
        expect(resolveEthereumAssetSupply(paramsFor(USDC)).amount).toBeNull()
    })
})
