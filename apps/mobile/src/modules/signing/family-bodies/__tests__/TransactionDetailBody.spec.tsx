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

import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@test-utils/render'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    buildAlgorandAssetTransferFixture,
    buildAlgorandDisplayFixture,
    FIXTURE_RECEIVER,
    FIXTURE_SENDER,
    FIXTURE_TRANSACTION_ID,
    type AlgorandDisplayFixtureKind,
} from '@test-utils/algorand-display-fixtures'
import { TransactionDetailBody } from '../TransactionDetailBody'
import type { FamilyTransaction } from '../types'

// The global mock stubs the blockchain barrel; the bodies classify with the real utils.
vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', async () => ({
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/transactions')
    >('@packages/chain-algorand/src/blockchain/utils/transactions')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/json')
    >('@packages/chain-algorand/src/blockchain/utils/json')),
    ...(await vi.importActual<
        typeof import('@packages/chain-algorand/src/blockchain/utils/addresses')
    >('@packages/chain-algorand/src/blockchain/utils/addresses')),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: () => ({ data: undefined }),
}))

const mockNetworkConfig = { explorerUrl: 'https://explorer.test' }
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: () => ({
        network: 'mainnet',
        networkConfig: mockNetworkConfig,
    }),
}))

const renderDetail = (
    transaction: PeraDisplayableTransaction,
    onRelatedTransactionPress?: (related: FamilyTransaction) => void,
) =>
    render(
        <TransactionDetailBody
            transaction={{ family: 'algorand', transaction }}
            onRelatedTransactionPress={onRelatedTransactionPress}
        />,
    )

type DetailExpectation = {
    title: string
    participants: [label: string, address: string][]
}

const DETAIL_KINDS: [AlgorandDisplayFixtureKind, DetailExpectation][] = [
    [
        'payment',
        {
            title: 'transactions.type.pay',
            participants: [
                ['transactions.common.from', FIXTURE_SENDER],
                ['transactions.common.sent_to', FIXTURE_RECEIVER],
            ],
        },
    ],
    [
        'asset-transfer',
        {
            title: 'transactions.type.axfer',
            participants: [
                ['transactions.common.from', FIXTURE_SENDER],
                ['transactions.common.sent_to', FIXTURE_RECEIVER],
            ],
        },
    ],
    [
        'asset-config',
        {
            title: 'transactions.type.acfg',
            participants: [
                ['transactions.asset_config.manager', FIXTURE_SENDER],
            ],
        },
    ],
    [
        'asset-freeze',
        {
            title: 'transactions.type.afrz',
            participants: [
                ['transactions.asset_freeze.target', FIXTURE_RECEIVER],
            ],
        },
    ],
    [
        'key-registration',
        {
            title: 'transactions.type.keyreg',
            participants: [['transactions.common.from', FIXTURE_SENDER]],
        },
    ],
    ['app-call', { title: 'transactions.type.appl', participants: [] }],
    [
        'heartbeat',
        {
            title: 'transactions.type.hb',
            participants: [
                ['transactions.heartbeat.account', FIXTURE_RECEIVER],
                ['transactions.heartbeat.submitted_by', FIXTURE_SENDER],
            ],
        },
    ],
]

describe('TransactionDetailBody', () => {
    beforeEach(() => {
        mockNetworkConfig.explorerUrl = 'https://explorer.test'
    })

    describe.each(DETAIL_KINDS)('%s', (kind, expected) => {
        beforeEach(() => {
            renderDetail(buildAlgorandDisplayFixture(kind))
        })

        it('renders the header with the type title and completed status', () => {
            expect(screen.getByText(expected.title)).toBeTruthy()
            expect(
                screen.getByText('transactions.common.completed'),
            ).toBeTruthy()
        })

        it('renders the transaction identifier and the explorer link', () => {
            expect(screen.getByText(FIXTURE_TRANSACTION_ID)).toBeTruthy()
            expect(
                screen.getByTestId('transaction_detail_explorer'),
            ).toBeTruthy()
        })

        it('renders the fee', () => {
            const feeRow = screen.getByTestId('transaction_detail_fee')
            expect(
                within(feeRow).getByText('transactions.common.fee'),
            ).toBeTruthy()
            expect(within(feeRow).getByText(/0\.001/)).toBeTruthy()
        })

        if (expected.participants.length > 0) {
            it('renders the participants', () => {
                for (const [label, address] of expected.participants) {
                    expect(screen.getByText(label)).toBeTruthy()
                    expect(screen.getAllByText(address).length).toBeGreaterThan(
                        0,
                    )
                }
            })
        }
    })

    it.each([
        ['opt-out', 'transactions.common.close_to', FIXTURE_RECEIVER],
        [
            'clawback',
            'transactions.asset_transfer.clawback_from',
            FIXTURE_RECEIVER,
        ],
    ] as const)(
        'renders the asset %s row alongside the fee',
        (variant, label, address) => {
            renderDetail(buildAlgorandAssetTransferFixture(variant))

            expect(screen.getByText('transactions.type.axfer')).toBeTruthy()
            expect(screen.getByText(label)).toBeTruthy()
            expect(screen.getAllByText(address).length).toBeGreaterThan(0)
            expect(screen.getByTestId('transaction_detail_fee')).toBeTruthy()
        },
    )

    it.each([
        ['state-proof', 'transactions.type.stpf'],
        ['unknown', 'transactions.unknown.title'],
    ] as const)(
        'renders the %s placeholder instead of a body',
        (kind, title) => {
            renderDetail(buildAlgorandDisplayFixture(kind))

            expect(screen.getByText(title)).toBeTruthy()
            expect(screen.queryByTestId('transaction_detail_fee')).toBeNull()
        },
    )

    it('re-tags a pressed inner transaction with its family', () => {
        const onRelatedTransactionPress = vi.fn()
        const transaction = buildAlgorandDisplayFixture('app-call')
        renderDetail(transaction, onRelatedTransactionPress)

        fireEvent.click(screen.getByText('transactions.type.pay'))

        expect(onRelatedTransactionPress).toHaveBeenCalledWith({
            family: 'algorand',
            transaction: transaction.innerTxns?.[0],
        })
    })

    it('shows a pending status and no identifier or explorer link for an unsigned transaction', () => {
        renderDetail(buildAlgorandDisplayFixture('payment', { id: '' }))

        expect(screen.getByText('transactions.common.pending')).toBeTruthy()
        expect(screen.queryByText(FIXTURE_TRANSACTION_ID)).toBeNull()
        expect(screen.queryByTestId('transaction_detail_explorer')).toBeNull()
        expect(screen.getByTestId('transaction_detail_fee')).toBeTruthy()
    })

    it('hides the explorer link on a network without an explorer', () => {
        mockNetworkConfig.explorerUrl = ''
        renderDetail(buildAlgorandDisplayFixture('payment'))

        expect(screen.queryByTestId('transaction_detail_explorer')).toBeNull()
        expect(screen.getByText(FIXTURE_TRANSACTION_ID)).toBeTruthy()
    })
})
