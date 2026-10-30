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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { Decimal } from 'decimal.js'
import { algorandChainUi, resolveAlgorandAssetAbout } from '../chain-ui'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const about = (isNativeAsset: boolean, explorerUrl: string | undefined) =>
    resolveAlgorandAssetAbout({
        asset: {
            assetId: '31566704',
            peraMetadata: { explorerUrl },
        } as PeraAsset,
        scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        descriptor: algorandDescriptor,
        isNativeAsset,
    })

describe('resolveAlgorandAssetAbout', () => {
    it('labels an ASA with its ASA id and url and links it to Pera Explorer', () => {
        expect(
            about(false, 'https://explorer.perawallet.app/asset/31566704'),
        ).toEqual({
            idLabelKey: 'asset_details.about.asa_id',
            urlLabelKey: 'asset_details.about.asa_url',
            explorerLink: {
                url: 'https://explorer.perawallet.app/asset/31566704',
                label: 'Pera Explorer',
            },
        })
    })

    it('hides the id row for ALGO and links it to Algoscan', () => {
        expect(about(true, 'https://algoscan.app/asset/0')).toEqual({
            idLabelKey: null,
            urlLabelKey: 'asset_details.about.url',
            explorerLink: {
                url: 'https://algoscan.app/asset/0',
                label: 'Algoscan',
            },
        })
    })

    it.each([undefined, ''])(
        'has no explorer link when the backend sent %j',
        url => {
            expect(about(false, url).explorerLink).toBeNull()
        },
    )
})

describe('algorandChainUi.assetDetails.resolveSupply', () => {
    const supplyOf = (totalSupply: Decimal) =>
        algorandChainUi.assetDetails!.resolveSupply({
            asset: { assetId: '31566704', totalSupply } as PeraAsset,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            descriptor: algorandDescriptor,
            isNativeAsset: false,
        })

    it('keeps the total supply label and copy', () => {
        expect(supplyOf(new Decimal('10000000000'))).toEqual({
            labelKey: 'asset_details.markets.total_supply',
            infoBodyKey: 'asset_details.markets.total_supply_info_body',
            amount: new Decimal('10000000000'),
        })
    })

    it('has no figure for an asset whose supply never loaded', () => {
        expect(supplyOf(new Decimal(0)).amount).toBeNull()
    })
})
