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

import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAccountSummaryLine } from '../useAccountSummaryLine'

const state = vi.hoisted(() => ({
    crossChainTotal: undefined as unknown,
}))

const NATIVE = { assetId: '0' }

vi.mock('@components/AccountWithBalance', () => ({
    useAccountWithBalance: () => ({ crossChainTotal: state.crossChainTotal }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountSummaryQuery: () => ({
        holdingsCount: 2,
        portfolioNativeValue: new Decimal('0.2'),
    }),
    useAccountHoldingsCountQuery: () => ({ holdingsCount: 5 }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

const ACCOUNT = { id: 'a' } as WalletAccount

describe('useAccountSummaryLine', () => {
    beforeEach(() => {
        state.crossChainTotal = undefined
    })

    it('keeps the Algorand count and ALGO value while one chain is active', () => {
        const { result } = renderHook(() =>
            useAccountSummaryLine(ACCOUNT, 'ALGO'),
        )

        expect(result.current).toEqual({
            holdingsCount: 2,
            value: {
                kind: 'native',
                asset: NATIVE,
                value: new Decimal('0.2'),
            },
        })
    })

    it("counts every chain's assets and shows the overview's fiat total across chains", () => {
        const total = new Decimal('3007')
        state.crossChainTotal = { kind: 'fiat', value: total }

        const { result } = renderHook(() =>
            useAccountSummaryLine(ACCOUNT, 'ALGO'),
        )

        expect(result.current).toEqual({
            holdingsCount: 5,
            value: { kind: 'fiat', value: total },
        })
    })

    it.each(['testOnly', 'unavailable'])(
        'shows no value when the total is %s, rather than a misleading 0',
        kind => {
            state.crossChainTotal = { kind }

            const { result } = renderHook(() =>
                useAccountSummaryLine(ACCOUNT, 'ALGO'),
            )

            expect(result.current).toEqual({
                holdingsCount: 5,
                value: { kind: 'none' },
            })
        },
    )
})
