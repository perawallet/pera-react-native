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
import { renderHook, waitFor } from '@testing-library/react'
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
import { TransactionDetailNotFoundError } from '../../errors'
import {
    MAX_RECORD_LOOKUP_PAGES,
    useTransactionRecordByIdQuery,
} from '../useTransactionRecordByIdQuery'

const mocks = vi.hoisted(() => ({
    getMinedTransactionHistory: vi.fn(),
    getPendingTransactionRecords: vi.fn(),
}))

vi.mock('../../pending-history', () => ({
    getPendingTransactionRecords: mocks.getPendingTransactionRecords,
    getMinedTransactionHistory: mocks.getMinedTransactionHistory,
}))
vi.mock('../historyReadRetry', async importOriginal => ({
    ...(await importOriginal<typeof import('../historyReadRetry')>()),
    historyReadRetryDelay: () => 0,
}))

const ADDRESS = '0xabc'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const HASH = `0x${'ab'.repeat(32)}`

const record = (id: string): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: 'confirmed',
    timestamp: Date.parse('2026-01-10T12:00:00Z'),
    summary: {
        kind: 'approval',
        title: { key: i18nKey('transactions.list_item.approval') },
        direction: 'none',
        icon: 'approval',
    },
    chainData: { family: 'evm' },
})

const cursor = (n: number) => ({ cursor: `page-${n}` }) as never

describe('useTransactionRecordByIdQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const renderLookup = (
        overrides: Partial<{
            accountAddress: string
            transactionId: string
            isEnabled: boolean
        }> = {},
    ) =>
        renderHook(
            () =>
                useTransactionRecordByIdQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    transactionId: HASH,
                    ...overrides,
                }),
            { wrapper },
        )

    beforeEach(() => {
        vi.resetAllMocks()
        mocks.getPendingTransactionRecords.mockResolvedValue([])
        onlineManager.setOnline(true)
        queryClient = new QueryClient()
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

    test('finds the record on page one without reading the ledger', async () => {
        const target = record(HASH)
        mocks.getMinedTransactionHistory.mockResolvedValue({
            items: [record('0x1'), target],
            next: cursor(2),
        })

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.data).toBe(target))
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(1)
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledWith(
            ADDRESS,
            SCOPE,
            undefined,
            { signal: expect.any(AbortSignal) },
        )
        expect(mocks.getPendingTransactionRecords).not.toHaveBeenCalled()
    })

    test('follows next until the page that lists it', async () => {
        const target = record(HASH)
        mocks.getMinedTransactionHistory
            .mockResolvedValueOnce({ items: [record('0x1')], next: cursor(2) })
            .mockResolvedValueOnce({ items: [record('0x2')], next: cursor(3) })
            .mockResolvedValueOnce({ items: [target] })

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.data).toBe(target))
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(3)
        expect(mocks.getMinedTransactionHistory).toHaveBeenLastCalledWith(
            ADDRESS,
            SCOPE,
            cursor(3),
            expect.anything(),
        )
    })

    test('stops after MAX_RECORD_LOOKUP_PAGES reads and reports not found', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValue({
            items: [record('0x1')],
            next: cursor(2),
        })

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.isError).toBe(true))
        // One quiet re-read follows the first failed lookup.
        expect(mocks.getMinedTransactionHistory).toHaveBeenCalledTimes(
            MAX_RECORD_LOOKUP_PAGES * 2,
        )
        expect(result.current.error).toBeInstanceOf(
            TransactionDetailNotFoundError,
        )
    })

    test("falls back to the wallet's own sends when the backend lacks it", async () => {
        const sent = record(HASH)
        mocks.getMinedTransactionHistory.mockResolvedValue({ items: [] })
        mocks.getPendingTransactionRecords.mockResolvedValue([sent])

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.data).toBe(sent))
        expect(mocks.getPendingTransactionRecords).toHaveBeenCalledWith({
            address: ADDRESS,
            scope: SCOPE,
        })
    })

    test('reports not found when neither the backend nor the ledger has it', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValue({ items: [] })

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(
            TransactionDetailNotFoundError,
        )
        expect(result.current.data).toBeUndefined()
    })

    test.each([
        ['disabled', { isEnabled: false }],
        ['no id', { transactionId: '' }],
        ['no address', { accountAddress: '' }],
    ])('reads nothing when %s', (_name, overrides) => {
        renderLookup(overrides)

        expect(mocks.getMinedTransactionHistory).not.toHaveBeenCalled()
        expect(mocks.getPendingTransactionRecords).not.toHaveBeenCalled()
    })

    test('reads the account unfiltered, with no asset', async () => {
        mocks.getMinedTransactionHistory.mockResolvedValue({
            items: [record(HASH)],
        })

        const { result } = renderLookup()

        await waitFor(() => expect(result.current.data).toBeDefined())
        const options = mocks.getMinedTransactionHistory.mock.calls[0][3]
        expect(options).not.toHaveProperty('assetId')
    })
})
