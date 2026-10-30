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
import { neutralAssetDetailsDisplay } from '../neutralAssetDetailsDisplay'

const ethereum = evmChainOf('ethereum')
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const paramsFor = (assetId: string, isNativeAsset: boolean) => ({
    asset: { assetId, totalSupply: new Decimal('1000') } as PeraAsset,
    scope: { chainId: 'ethereum', networkId: 'mainnet' } as const,
    descriptor: ethereum.descriptor,
    isNativeAsset,
})

describe('neutralAssetDetailsDisplay', () => {
    it('labels a token by its asset id and links the descriptor explorer', () => {
        expect(
            neutralAssetDetailsDisplay.resolveAbout(paramsFor(USDC, false)),
        ).toEqual({
            idLabelKey: 'asset_details.collectible.asset_id',
            urlLabelKey: 'asset_details.about.url',
            explorerLink: {
                url: `https://etherscan.io/token/${USDC}`,
                label: 'etherscan.io',
            },
        })
    })

    it('hides the id row and the explorer link for a native asset', () => {
        const about = neutralAssetDetailsDisplay.resolveAbout(
            paramsFor('native', true),
        )

        expect(about.idLabelKey).toBeNull()
        expect(about.explorerLink).toBeNull()
    })

    it('shows the supply under the total supply copy', () => {
        expect(
            neutralAssetDetailsDisplay.resolveSupply(paramsFor(USDC, false))
                .labelKey,
        ).toBe('asset_details.markets.total_supply')
    })
})
