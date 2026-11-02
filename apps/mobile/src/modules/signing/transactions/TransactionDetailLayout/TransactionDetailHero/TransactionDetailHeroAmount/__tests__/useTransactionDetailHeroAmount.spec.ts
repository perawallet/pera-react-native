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
import { usePreferredAmount } from '@components/PreferredAmount'
import { useTransactionDetailHeroAmount } from '../useTransactionDetailHeroAmount'

vi.mock('@components/PreferredAmount', () => ({
    usePreferredAmount: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const AMOUNT = {
    asset: { assetId: 'native', unitName: 'ETH', decimals: 18 },
    value: new Decimal('1.5'),
}

const withPrice = (convertedValue: Decimal | null, isPending = false): void => {
    vi.mocked(usePreferredAmount).mockReturnValue({
        displayCurrency: 'USD',
        convertedValue,
        isPending,
    })
}

describe('useTransactionDetailHeroAmount', () => {
    beforeEach(() => {
        vi.mocked(usePreferredAmount).mockReset()
    })

    it('Given a priced asset, then fiat leads', () => {
        withPrice(new Decimal(3000))

        const { result } = renderHook(() =>
            useTransactionDetailHeroAmount(AMOUNT, SCOPE),
        )

        expect(result.current.isFiatLeading).toBe(true)
        expect(usePreferredAmount).toHaveBeenCalledWith(
            AMOUNT.value,
            'native',
            undefined,
            undefined,
            SCOPE,
        )
    })

    it('Given an asset with no price, then the native amount leads', () => {
        withPrice(null)

        const { result } = renderHook(() =>
            useTransactionDetailHeroAmount(AMOUNT, SCOPE),
        )

        expect(result.current.isFiatLeading).toBe(false)
    })

    it('Given a price still loading, then fiat holds the lead so the figure never jumps', () => {
        withPrice(null, true)

        const { result } = renderHook(() =>
            useTransactionDetailHeroAmount(AMOUNT, SCOPE),
        )

        expect(result.current.isFiatLeading).toBe(true)
    })
})
