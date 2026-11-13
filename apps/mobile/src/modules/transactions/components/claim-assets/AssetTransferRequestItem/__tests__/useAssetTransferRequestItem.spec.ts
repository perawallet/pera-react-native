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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { useAssetTransferRequestItem } from '../useAssetTransferRequestItem'

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: () => ({ displayName: 'Resolved' }),
}))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const buildItem = (unitName: string) =>
    ({
        id: '741',
        totalAmount: new Decimal(250),
        usdValue: null,
        asset: { assetId: '741', decimals: 0, name: 'Spoof', unitName },
        senders: { count: 0, results: [] },
    }) as unknown as AssetInboxRequest

describe('useAssetTransferRequestItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reports the code the unit name imitates, judged on the asset id and the payload unit name', () => {
        vi.mocked(imitatedCurrencyOf).mockReturnValueOnce('USD')

        const { result } = renderHook(() =>
            useAssetTransferRequestItem(buildItem('usd'), SCOPE),
        )

        expect(result.current.imitatedCurrency).toBe('USD')
        expect(imitatedCurrencyOf).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '741' },
            'usd',
        )
    })

    it('has no imitated currency for an ordinary asset', () => {
        const { result } = renderHook(() =>
            useAssetTransferRequestItem(buildItem('TST'), SCOPE),
        )

        expect(result.current.imitatedCurrency).toBeNull()
    })
})
