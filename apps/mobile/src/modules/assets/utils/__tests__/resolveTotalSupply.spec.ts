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
import {
    LEGACY_CHAIN_ID,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { resolveTotalSupply } from '../resolveTotalSupply'

const supplyOf = (totalSupply: Decimal) =>
    resolveTotalSupply({
        asset: { assetId: '1', decimals: 6, totalSupply } as PeraAsset,
        scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' },
        descriptor: {} as ChainDescriptor,
        isNativeAsset: false,
    })

describe('resolveTotalSupply', () => {
    it('shows a known supply under the total supply copy', () => {
        const display = supplyOf(new Decimal('1000000'))

        expect(display.labelKey).toBe('asset_details.markets.total_supply')
        expect(display.infoBodyKey).toBe(
            'asset_details.markets.total_supply_info_body',
        )
        expect(display.amount?.toFixed()).toBe('1000000')
    })

    it('treats a zero supply as unknown', () => {
        expect(supplyOf(new Decimal(0)).amount).toBeNull()
    })
})
