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
import { useTransactionDetailFeeRow } from '../useTransactionDetailFeeRow'

vi.mock('@components/PreferredAmount', () => ({
    usePreferredAmount: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const FEE = {
    asset: { assetId: 'native', unitName: 'ETH', decimals: 18 },
    value: new Decimal('0.000021'),
}

const withPrice = (convertedValue: Decimal | null, isPending = false): void => {
    vi.mocked(usePreferredAmount).mockReturnValue({
        displayCurrency: 'USD',
        convertedValue,
        isPending,
    })
}

describe('useTransactionDetailFeeRow', () => {
    beforeEach(() => {
        vi.mocked(usePreferredAmount).mockReset()
    })

    it('Given a priced native asset, then the fee shows its fiat value', () => {
        withPrice(new Decimal('0.07'))

        const { result } = renderHook(() =>
            useTransactionDetailFeeRow(FEE, SCOPE),
        )

        expect(result.current.hasFiat).toBe(true)
        expect(usePreferredAmount).toHaveBeenCalledWith(
            FEE.value,
            'native',
            undefined,
            undefined,
            SCOPE,
        )
    })

    it('Given no price, then the fee shows no empty fiat line', () => {
        withPrice(null)

        const { result } = renderHook(() =>
            useTransactionDetailFeeRow(FEE, SCOPE),
        )

        expect(result.current.hasFiat).toBe(false)
    })

    it('Given a price still loading, then the fiat line holds its place', () => {
        withPrice(null, true)

        const { result } = renderHook(() =>
            useTransactionDetailFeeRow(FEE, SCOPE),
        )

        expect(result.current.hasFiat).toBe(true)
    })
})
