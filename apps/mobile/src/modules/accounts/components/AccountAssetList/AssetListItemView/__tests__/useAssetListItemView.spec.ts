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
import { Decimal } from 'decimal.js'
import type { AccountHoldingsLiteRow } from '@perawallet/wallet-core-accounts'
import { useAssetListItemView } from '../useAssetListItemView'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    // The row carries no joined metadata here; the conversion is what matters.
    assetFromHoldingLiteRow: () => null,
}))

const holding = {
    assetId: '31566704',
    amount: new Decimal(1_000_000),
} as unknown as AccountHoldingsLiteRow

describe('useAssetListItemView', () => {
    it('converts the holding to the preferred currency', () => {
        const convertFiat = vi.fn(() => ({
            displayCurrency: 'USD',
            value: new Decimal(5),
        }))

        const { result } = renderHook(() =>
            useAssetListItemView({
                holding,
                chainId: 'algorand',
                convertFiat,
            }),
        )

        expect(convertFiat).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '31566704' },
            holding.usdPrice,
            expect.anything(),
        )
        expect(result.current.fiat.displayCurrency).toBe('USD')
    })
})
