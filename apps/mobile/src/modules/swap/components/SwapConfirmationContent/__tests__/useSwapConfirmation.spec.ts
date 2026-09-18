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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { useSwapConfirmation } from '../useSwapConfirmation'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

const quote = {
    assetIn: { assetId: '0', unitName: 'ALGO', verificationTier: 'trusted' },
    assetOut: {
        assetId: '31566704',
        unitName: 'USDC',
        verificationTier: 'trusted',
    },
} as SwapQuote

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'ADDR' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: () => ({ data: new Map() }),
    formatAssetAmount: () => '-',
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'USD',
        usdToPreferred: (value: unknown) => value,
    }),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        detailValue: {},
        priceImpactLow: {},
        priceImpactMedium: {},
        priceImpactHigh: {},
    }),
}))

describe('useSwapConfirmation', () => {
    it.each([
        ['preparing', true, true, false],
        ['signing', true, false, true],
        ['submitting', true, false, true],
        // A swap that partly landed is not "processing": the sheet is
        // escapable and the slider is live again so the user can finish the
        // rest.
        ['partially-submitted', false, false, false],
        ['success', false, false, false],
        ['error', false, false, false],
    ])(
        'derives the gates for %s',
        (status, isProcessing, isCancellable, isCommitted) => {
            const { result } = renderHook(() =>
                useSwapConfirmation({
                    quote,
                    swapStatus: status as never,
                }),
            )

            expect(result.current.isProcessing).toBe(isProcessing)
            expect(result.current.isCancellable).toBe(isCancellable)
            expect(result.current.isCommitted).toBe(isCommitted)
        },
    )
})
