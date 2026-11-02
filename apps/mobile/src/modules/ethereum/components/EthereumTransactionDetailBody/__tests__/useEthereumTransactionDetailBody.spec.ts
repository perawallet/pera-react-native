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
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import {
    useEthereumTransactionPresentation,
    type EthereumTransactionPresentation,
} from '../../../hooks/useEthereumTransactionPresentation'
import { useEthereumTransactionDetailBody } from '../useEthereumTransactionDetailBody'

const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ETHER = { assetId: 'native', unitName: 'ETH', decimals: 18 }
const NATIVE: TransactionNative = { family: 'evm', transaction: {} }

// The suffix has its own spec; here the hero's title is the row label it wraps.
vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

vi.mock('../../../hooks/useEthereumTransactionPresentation', () => ({
    useEthereumTransactionPresentation: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const presentationOf = (
    overrides: Record<string, unknown> = {},
    view: Record<string, unknown> = {},
): EthereumTransactionPresentation =>
    ({
        scope: SCOPE,
        titleKey: 'transactions.list_item.send',
        iconName: 'send-icon',
        isTransfer: true,
        counterparty: PEER,
        isAmountLoading: false,
        amount: { asset: ETHER, value: new Decimal(1) },
        feePaid: null,
        view: { from: ME, ...view },
        ...overrides,
    }) as unknown as EthereumTransactionPresentation

const bodyOf = (presentation: EthereumTransactionPresentation | null) => {
    vi.mocked(useEthereumTransactionPresentation).mockReturnValue(presentation)
    return renderHook(() => useEthereumTransactionDetailBody(NATIVE, SCOPE))
        .result.current
}

describe('useEthereumTransactionDetailBody', () => {
    beforeEach(() => {
        vi.mocked(useEthereumTransactionPresentation).mockReset()
    })

    it("Given a transfer before it is signed, then it is pending, with the sent asset as the hero's amount, no id and no fee yet", () => {
        const { summary } = bodyOf(presentationOf())

        expect(summary).toMatchObject({
            scope: SCOPE,
            title: 'transactions.list_item.send',
            iconName: 'send-icon',
            status: 'pending',
            from: ME,
            to: PEER,
        })
        expect(summary?.amount?.value.toString()).toBe('1')
        expect(summary?.transactionId).toBeUndefined()
        expect(summary?.fee).toBeUndefined()
    })

    it('Given a transaction already mined, then it is completed and carries the fee it cost', () => {
        const { summary } = bodyOf(
            presentationOf({
                feePaid: { asset: ETHER, value: new Decimal('0.002') },
                view: { from: ME, isMined: true },
            }),
        )

        expect(summary?.status).toBe('completed')
        expect(summary?.fee?.value.toString()).toBe('0.002')
    })

    it("Given a transfer whose asset can't be named, then it leads with no amount", () => {
        const { summary } = bodyOf(
            presentationOf({
                amount: { asset: null, value: new Decimal(5) },
            }),
        )

        expect(summary?.amount).toBeUndefined()
    })

    it('Given a token whose asset is still being read, then the hero holds its place', () => {
        const { summary } = bodyOf(
            presentationOf({
                amount: { asset: null, value: new Decimal(5) },
                isAmountLoading: true,
            }),
        )

        expect(summary?.amount).toBeUndefined()
        expect(summary?.isAmountLoading).toBe(true)
    })

    it('Given a contract call, then it has no recipient or amount of its own', () => {
        const { summary } = bodyOf(
            presentationOf({
                isTransfer: false,
                amount: undefined,
                counterparty: PEER,
            }),
        )

        expect(summary?.to).toBeUndefined()
        expect(summary?.amount).toBeUndefined()
    })

    it('Given a transaction it cannot read, then there is nothing to show', () => {
        expect(bodyOf(null)).toEqual({ presentation: null, summary: null })
    })
})
