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
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    buildAlgorandAssetTransferFixture,
    buildAlgorandDisplayFixture,
    FIXTURE_ASSET_ID,
    FIXTURE_RECEIVER,
    FIXTURE_SENDER,
    FIXTURE_TRANSACTION_ID,
    type AlgorandDisplayFixtureKind,
} from '@test-utils/algorand-display-fixtures'
import { useAlgorandTransactionDetailLayout } from '../useAlgorandTransactionDetailLayout'

// The global mock stubs the blockchain barrel; the hook classifies with the real utils.
// The suffix has its own spec; here the hero's title is the row label it wraps.
vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle:
        () =>
        ({ key }: { key: string }) =>
            key,
}))

vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/transactions')
    >('@packages/chain-algorand/src/blockchain/utils/transactions')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/models/transaction-view')
    >('@packages/chain-algorand/src/blockchain/models/transaction-view')),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => ({
        assetId: '0',
        unitName: 'ALGO',
        decimals: 6,
    }),
    useSingleAssetDetailsQuery: vi.fn(),
}))

let mockViewer: string | undefined
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => (mockViewer ? { address: mockViewer } : null),
    chainAccountOf: (account: { address: string }) => account,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const USDC = {
    assetId: String(FIXTURE_ASSET_ID),
    unitName: 'USDC',
    decimals: 6,
}

const viewOf = (
    kind: AlgorandDisplayFixtureKind,
    overrides: Partial<AlgorandTransactionView> = {},
): AlgorandTransactionView =>
    buildAlgorandDisplayFixture(kind, overrides)
        .transaction as AlgorandTransactionView

const summaryOf = (transaction: AlgorandTransactionView) =>
    renderHook(() => useAlgorandTransactionDetailLayout(transaction)).result
        .current

describe('useAlgorandTransactionDetailLayout', () => {
    beforeEach(() => {
        mockViewer = undefined
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: USDC,
            isPending: false,
        } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)
    })

    it('Given a confirmed payment, then it carries the id, round, time, parties and fee in display units', () => {
        mockViewer = FIXTURE_SENDER
        const summary = summaryOf(
            viewOf('payment', {
                confirmedRound: 42n,
                roundTimeMillis: 1_700_000_000_000,
            }),
        )

        expect(summary).toMatchObject({
            status: 'completed',
            transactionId: FIXTURE_TRANSACTION_ID,
            timestamp: 1_700_000_000_000,
            block: { labelKey: 'transactions.common.round', number: '42' },
            from: FIXTURE_SENDER,
            to: FIXTURE_RECEIVER,
        })
        expect(summary.scope.chainId).toBe('algorand')
        expect(summary.fee?.value.toString()).toBe('0.001')
        expect(summary.fee?.asset.unitName).toBe('ALGO')
    })

    it('Given a confirmed payment viewed by its receiver, then it shows no fee, since the sender paid it', () => {
        mockViewer = FIXTURE_RECEIVER

        expect(
            summaryOf(viewOf('payment', { confirmedRound: 42n })).fee,
        ).toBeUndefined()
    })

    it('Given an unsigned transaction, then it keeps its fee whoever is viewing, since it is about to be signed', () => {
        mockViewer = FIXTURE_RECEIVER

        expect(
            summaryOf(
                viewOf('payment', { id: '', confirmedRound: undefined }),
            ).fee?.value.toString(),
        ).toBe('0.001')
    })

    it('Given a payment viewed by its sender, then it is titled Send, as history names it', () => {
        mockViewer = FIXTURE_SENDER

        expect(summaryOf(viewOf('payment')).title).toBe(
            'transactions.list_item.send',
        )
    })

    it('Given a payment viewed by anyone else, then it is titled Receive', () => {
        mockViewer = FIXTURE_RECEIVER

        expect(summaryOf(viewOf('payment')).title).toBe(
            'transactions.list_item.receive',
        )
    })

    it('Given an asset opt-in, then it is titled Opt-in', () => {
        const optIn = buildAlgorandAssetTransferFixture('opt-in')
            .transaction as AlgorandTransactionView

        expect(summaryOf(optIn).title).toBe('transactions.list_item.opt_in')
    })

    it("Given a payment, then its paid leg in algos is the hero's amount", () => {
        const summary = summaryOf(viewOf('payment'))

        expect(summary.amount?.value.toString()).toBe('2.5')
        expect(summary.amount?.asset.unitName).toBe('ALGO')
    })

    it('Given an unsigned transaction, then it is pending with no id, time or round', () => {
        const summary = summaryOf(
            viewOf('payment', {
                id: '',
                confirmedRound: undefined,
                roundTimeMillis: undefined,
            }),
        )

        expect(summary.status).toBe('pending')
        expect(summary.transactionId).toBeUndefined()
        expect(summary.timestamp).toBeUndefined()
        expect(summary.block).toBeUndefined()
    })

    it('Given an inner transaction with a round but no id, then it reads as completed', () => {
        const summary = summaryOf(
            viewOf('payment', { id: '', confirmedRound: 42n }),
        )

        expect(summary.status).toBe('completed')
        expect(summary.transactionId).toBeUndefined()
    })

    it("Given an asset transfer, then the transferred asset is the hero's amount", () => {
        const summary = summaryOf(viewOf('asset-transfer'))

        expect(summary.amount?.asset).toEqual(USDC)
        expect(summary.to).toBe(FIXTURE_RECEIVER)
    })

    it('Given a u64-max asset amount, then it converts exactly', () => {
        const transfer = viewOf('asset-transfer')
        const summary = summaryOf({
            ...transfer,
            assetTransferTransaction: {
                ...transfer.assetTransferTransaction!,
                amount: 18_446_744_073_709_551_615n,
            },
        })

        expect(summary.amount?.value.toString()).toBe('18446744073709.551615')
    })

    it('Given an asset transfer whose asset is not resolved, then it leads with no amount', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

        const summary = summaryOf(viewOf('asset-transfer'))

        expect(summary.amount).toBeUndefined()
        expect(summary.isAmountLoading).toBe(true)
    })

    it('Given an asset the lookup settled with no result, then the hero stops holding its place', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
            isPending: false,
        } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

        const summary = summaryOf(viewOf('asset-transfer'))

        expect(summary.amount).toBeUndefined()
        expect(summary.isAmountLoading).toBe(false)
    })

    it('Given a payment, an opt-in or a resolved asset, then nothing is loading', () => {
        expect(summaryOf(viewOf('payment')).isAmountLoading).toBe(false)
        expect(summaryOf(viewOf('asset-transfer')).isAmountLoading).toBe(false)
        expect(
            summaryOf(
                buildAlgorandAssetTransferFixture('opt-in')
                    .transaction as AlgorandTransactionView,
            ).isAmountLoading,
        ).toBe(false)
    })

    it('Given an asset opt-in, then it has no amount and no recipient', () => {
        const summary = summaryOf(
            buildAlgorandAssetTransferFixture('opt-in')
                .transaction as AlgorandTransactionView,
        )

        expect(summary.amount).toBeUndefined()
        expect(summary.to).toBeUndefined()
    })

    it('Given an application call, then it has no amount and no recipient', () => {
        const summary = summaryOf(viewOf('app-call'))

        expect(summary.amount).toBeUndefined()
        expect(summary.to).toBeUndefined()
        expect(summary.from).toBe(FIXTURE_SENDER)
    })

    it('Given a note, then it is decoded, and a transaction with none has no note', () => {
        const withNote = summaryOf(
            viewOf('payment', { note: new TextEncoder().encode('rent') }),
        )
        const withoutNote = summaryOf(viewOf('payment', { note: undefined }))

        expect(withNote.note).toBe('rent')
        expect(withoutNote.note).toBeUndefined()
    })
})
