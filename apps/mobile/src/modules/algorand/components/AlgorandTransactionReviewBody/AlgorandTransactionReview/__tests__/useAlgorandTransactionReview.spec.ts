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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    classifyDisplayableTransaction,
    type AlgorandTransactionKind,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import { useAlgorandTransactionReview } from '../useAlgorandTransactionReview'

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<object>()),
        classifyDisplayableTransaction: vi.fn(),
        encodeAlgorandAddress: () => 'AUTH',
    }),
)

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    useFindAccountByAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSingleAssetDetailsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'testnet' }),
}))

vi.mock('@modules/signing', () => ({
    useBalanceImpactSummary: () => ({}),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const VIEW = {
    sender: 'SENDER',
    paymentTransaction: { receiver: 'PAY_RECEIVER' },
    assetTransferTransaction: {
        receiver: 'ASA_RECEIVER',
        assetId: 31_566_704n,
    },
    applicationTransaction: { applicationId: 1234n },
} as unknown as AlgorandTransactionView

const reviewOf = (
    kind: AlgorandTransactionKind,
    view: AlgorandTransactionView = VIEW,
) => {
    vi.mocked(classifyDisplayableTransaction).mockReturnValue(kind)
    return renderHook(() => useAlgorandTransactionReview(view)).result.current
}

describe('useAlgorandTransactionReview', () => {
    beforeEach(() => {
        vi.mocked(useFindAccountByAddress).mockReturnValue(null)
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: { unitName: 'USDC', name: 'USD Coin' },
        } as ReturnType<typeof useSingleAssetDetailsQuery>)
    })

    it('aims a payment at its receiver', () => {
        expect(reviewOf('payment')).toMatchObject({
            title: 'transactions.list_item.send',
            target: { kind: 'address', address: 'PAY_RECEIVER' },
        })
    })

    it('aims an asset transfer and a clawback at the asset receiver', () => {
        expect(reviewOf('asset-transfer').target).toEqual({
            kind: 'address',
            address: 'ASA_RECEIVER',
        })
        expect(reviewOf('asset-clawback')).toMatchObject({
            title: 'signing.review.title_clawback',
            target: { kind: 'address', address: 'ASA_RECEIVER' },
        })
    })

    it('aims an opt-in at the asset, by unit name, then name, then id', () => {
        expect(reviewOf('asset-opt-in').target).toEqual({
            kind: 'asset',
            label: 'USDC',
        })

        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
        } as ReturnType<typeof useSingleAssetDetailsQuery>)
        expect(reviewOf('asset-opt-out').target).toEqual({
            kind: 'asset',
            label: '31566704',
        })
    })

    it('aims an app call at its application', () => {
        expect(reviewOf('app-call').target).toEqual({
            kind: 'application',
            applicationId: '1234',
        })
    })

    it('has no target for a kind that names none', () => {
        expect(reviewOf('key-registration').target).toBeUndefined()
    })

    it('finds the signing account by the auth address of a rekeyed sender', () => {
        reviewOf('payment', {
            ...VIEW,
            authAddr: { publicKey: new Uint8Array(32) },
        } as unknown as AlgorandTransactionView)

        expect(vi.mocked(useFindAccountByAddress)).toHaveBeenCalledWith(
            'AUTH',
            expect.anything(),
        )
    })

    it('finds the signing account by the sender otherwise', () => {
        const { signingAccount } = reviewOf('payment')

        expect(vi.mocked(useFindAccountByAddress)).toHaveBeenCalledWith(
            'SENDER',
            expect.anything(),
        )
        expect(signingAccount).toBeNull()
    })
})
