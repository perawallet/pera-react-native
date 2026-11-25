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
// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useCurrentOwnRecord } from '../useCurrentOwnRecord'

const mocks = vi.hoisted(() => ({ getPendingTransactionRecords: vi.fn() }))

vi.mock('../../pending-history', () => ({
    getPendingTransactionRecords: mocks.getPendingTransactionRecords,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    subscribeToSubmissionLedger: () => () => undefined,
}))

const ADDRESS = '0xabc'
const SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }

const send = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: '0xhash',
    scope: SCOPE,
    status: 'pending',
    timestamp: 1_700_000_000_000,
    fee: new Decimal('230000000000'),
    isFeeMaximum: true,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transactions.list_item.send') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
    ...overrides,
})

describe('useCurrentOwnRecord', () => {
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.resetAllMocks()
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    })

    test("returns the ledger's landed version of a send opened while pending", async () => {
        const landed = send({
            status: 'confirmed',
            fee: new Decimal('126000000000'),
            isFeeMaximum: undefined,
            blockNumber: 42,
        })
        mocks.getPendingTransactionRecords.mockResolvedValue([landed])

        const { result } = renderHook(
            () =>
                useCurrentOwnRecord({
                    record: send(),
                    scope: SCOPE,
                    accountAddress: ADDRESS,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(landed))
    })

    test('keeps the snapshot while the ledger has no row for it', async () => {
        mocks.getPendingTransactionRecords.mockResolvedValue([])
        const snapshot = send()

        const { result } = renderHook(
            () =>
                useCurrentOwnRecord({
                    record: snapshot,
                    scope: SCOPE,
                    accountAddress: ADDRESS,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.getPendingTransactionRecords).toHaveBeenCalled(),
        )
        expect(result.current).toBe(snapshot)
    })

    test("returns a chain's own record as given, reading no ledger", () => {
        const mined = send({ status: 'confirmed', isFeeMaximum: undefined })

        const { result } = renderHook(
            () =>
                useCurrentOwnRecord({
                    record: mined,
                    scope: SCOPE,
                    accountAddress: ADDRESS,
                }),
            { wrapper },
        )

        expect(result.current).toBe(mined)
        expect(mocks.getPendingTransactionRecords).not.toHaveBeenCalled()
    })
})
