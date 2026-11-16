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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'
import {
    i18nKey,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { usePendingTransactionRecordsQuery } from '../usePendingTransactionRecordsQuery'

const mocks = vi.hoisted(() => ({
    getPendingTransactionRecords: vi.fn(),
    ledgerListeners: new Set<() => void>(),
}))

vi.mock('../../pending-history', () => ({
    getPendingTransactionRecords: mocks.getPendingTransactionRecords,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    subscribeToSubmissionLedger: (listener: () => void) => {
        mocks.ledgerListeners.add(listener)
        return () => mocks.ledgerListeners.delete(listener)
    },
}))

const ADDRESS = '0xabc'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }

const send = (id: string): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: 'pending',
    timestamp: 1_700_000_000_000,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transactions.list_item.send') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

describe('usePendingTransactionRecordsQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.resetAllMocks()
        mocks.ledgerListeners.clear()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        queryClient.clear()
    })

    test('reads the account’s sends from the ledger, offline too', async () => {
        onlineManager.setOnline(false)
        mocks.getPendingTransactionRecords.mockResolvedValue([send('0x1')])

        const { result } = renderHook(
            () =>
                usePendingTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['0x1']),
        )
        expect(mocks.getPendingTransactionRecords).toHaveBeenCalledWith({
            address: ADDRESS,
            scope: SCOPE,
            listedIds: new Set(),
        })
    })

    test('re-reads when the ledger changes', async () => {
        mocks.getPendingTransactionRecords.mockResolvedValue([])
        const { result } = renderHook(
            () =>
                usePendingTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() =>
            expect(mocks.getPendingTransactionRecords).toHaveBeenCalledTimes(1),
        )

        mocks.getPendingTransactionRecords.mockResolvedValue([send('0x2')])
        act(() => {
            for (const listener of mocks.ledgerListeners) listener()
        })

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['0x2']),
        )
    })

    test('reads nothing and listens to nothing when disabled', () => {
        renderHook(
            () =>
                usePendingTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    isEnabled: false,
                }),
            { wrapper },
        )

        expect(mocks.getPendingTransactionRecords).not.toHaveBeenCalled()
        expect(mocks.ledgerListeners.size).toBe(0)
    })
})
