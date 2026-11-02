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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountAssetItemView } from '../useAccountAssetItemView'

const mocks = vi.hoisted(() => ({ useAssetsQuery: vi.fn() }))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: mocks.useAssetsQuery,
}))

const scope = { chainId: 'algorand', networkId: 'mainnet' } as ChainScope

const collectibleAsset = {
    assetId: '31566704',
    peraMetadata: { type: 'collectible' },
} as unknown as PeraAsset

const balance = (asset?: PeraAsset): AssetWithAccountBalance =>
    ({
        assetId: '31566704',
        asset,
        amount: new Decimal(1),
    }) as AssetWithAccountBalance

describe('useAccountAssetItemView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useAssetsQuery.mockReturnValue({ data: new Map() })
    })

    it('asks for no asset when the holding already carries one', () => {
        const asset = { assetId: '31566704' } as PeraAsset
        const { result } = renderHook(() =>
            useAccountAssetItemView({
                accountBalance: balance(asset),
                skipFetch: false,
                scope,
            }),
        )

        expect(mocks.useAssetsQuery).toHaveBeenCalledWith(scope, [])
        expect(result.current.asset).toBe(asset)
    })

    it('reads the fetched asset and offers a collectible row', () => {
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([['31566704', collectibleAsset]]),
        })

        const { result } = renderHook(() =>
            useAccountAssetItemView({
                accountBalance: balance(),
                skipFetch: false,
                scope,
            }),
        )

        expect(mocks.useAssetsQuery).toHaveBeenCalledWith(scope, ['31566704'])
        expect(result.current.item?.assetId).toBe('31566704')
    })
})
