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
import { act, renderHook } from '@testing-library/react'
import {
    hasCachedHistoryRows,
    summarizeHistoryItem,
    useSuspectedPoisoningQuery,
    useTransactionHistoryQuery,
    useTransactionRecordsQuery,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
    type UseTransactionHistoryQueryResult,
    type UseTransactionRecordsQueryResult,
} from '@perawallet/wallet-core-transactions'
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { useKnownAddresses } from '../../address-safety/useKnownAddresses'
import { useTransactionHistoryRows } from '../useTransactionHistoryRows'

vi.mock('@perawallet/wallet-core-transactions', () => ({
    hasCachedHistoryRows: vi.fn(),
    summarizeHistoryItem: vi.fn(),
    useSuspectedPoisoningQuery: vi.fn(),
    useTransactionHistoryQuery: vi.fn(),
    useTransactionRecordsQuery: vi.fn(),
}))

vi.mock('../../address-safety/useKnownAddresses', () => ({
    useKnownAddresses: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    formatISODate: (date: Date) => date.toISOString().split('T')[0],
}))

const historyResult = (
    overrides: Partial<UseTransactionHistoryQueryResult> = {},
): UseTransactionHistoryQueryResult => ({
    transactions: [],
    isLoading: false,
    isFetched: true,
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    isPaused: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
})

const recordsResult = (
    overrides: Partial<UseTransactionRecordsQueryResult> = {},
): UseTransactionRecordsQueryResult => ({
    records: [],
    isLoading: false,
    isFetched: true,
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isSearchPaused: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
})

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const KNOWN = [{ address: '0xALICE', source: 'contact' as const }]

describe('useTransactionHistoryRows', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.mocked(useTransactionHistoryQuery).mockReturnValue(historyResult())
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(recordsResult())
        vi.mocked(useKnownAddresses).mockReturnValue({
            knownAddresses: KNOWN,
            isPending: false,
            hasSenderHistory: true,
        })
        vi.mocked(useSuspectedPoisoningQuery).mockReturnValue({
            data: new Map(),
        })
    })

    it('reads records, with only the records query enabled, on a chain without cached rows', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        const record = {
            id: '0xhash',
            timestamp: 1_704_067_200_000,
        } as TransactionRecord
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({ records: [record] }),
        )

        const { result } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
                assetId: '0xusdc',
            }),
        )

        expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: '0xabc',
                assetId: '0xusdc',
                isEnabled: true,
            }),
        )
        expect(result.current.rows.map(row => row.kind)).toEqual([
            'header',
            'record',
        ])
        expect(result.current.transactionCount).toBe(1)
    })

    it('reads cached rows on a chain that keeps them', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(true)

        renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: 'ALGO',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            }),
        )

        expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: true }),
        )
        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })

    it('enables neither query without an address', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)

        renderHook(() => useTransactionHistoryRows({ scope: ETH_SCOPE }))

        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: '', isEnabled: false }),
        )
    })

    it('retries the next page after a failed one, and the first page otherwise', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        const failedNext = recordsResult({ isError: true, hasNextPage: true })
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(failedNext)

        const { result, rerender } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
            }),
        )
        act(() => result.current.retry())
        expect(failedNext.fetchNextPage).toHaveBeenCalledTimes(1)

        const failedFirst = recordsResult({ isError: true })
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(failedFirst)
        rerender()
        act(() => result.current.retry())
        expect(failedFirst.refetch).toHaveBeenCalledTimes(1)
    })
    it('reports a retry in flight only while the failed read is re-requested', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({ isError: true, isFetching: true }),
        )

        const { result, rerender } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
            }),
        )
        expect(result.current.isRetrying).toBe(true)

        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({ isFetching: true }),
        )
        rerender()
        expect(result.current.isRetrying).toBe(false)
    })

    it("passes the records query's paused search through, and never on cached rows", () => {
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({ isSearchPaused: true }),
        )
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)

        const { result, rerender } = renderHook(
            ({ scope }) =>
                useTransactionHistoryRows({ accountAddress: '0xabc', scope }),
            { initialProps: { scope: ETH_SCOPE as ChainScope } },
        )
        expect(result.current.isSearchPaused).toBe(true)

        vi.mocked(hasCachedHistoryRows).mockReturnValue(true)
        rerender({ scope: { chainId: 'algorand', networkId: 'mainnet' } })
        expect(result.current.isSearchPaused).toBe(false)
    })

    it('reports a load failure, and a missing Pera service as its own kind, only with nothing loaded', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({
                isError: true,
                error: new PeraServiceUnavailableError(ETH_SCOPE),
            }),
        )

        const { result } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
            }),
        )

        expect(result.current.isLoadFailed).toBe(true)
        expect(result.current.isLoadUnavailable).toBe(true)
        expect(result.current.isLoadIntegrityBlocked).toBe(false)
    })

    describe('suspected poisoning', () => {
        const recordOf = (id: string, timestamp: number) =>
            ({
                id,
                timestamp,
                initiator: '0xSIGNER',
                summary: { kind: 'transfer', direction: 'in' },
            }) as TransactionRecord
        const RECORDS = [
            recordOf('0xreal', 1_704_153_600_000),
            recordOf('0xpoison', 1_704_067_200_000),
            recordOf('0xolder', 1_704_067_100_000),
        ]
        const SUSPECTED: SuspectedPoisoning = {
            transactionId: '0xpoison',
            counterparty: '0xALlCE',
            imitates: KNOWN[0],
        }

        it("checks the account's records against its known addresses", () => {
            vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
            vi.mocked(useTransactionRecordsQuery).mockReturnValue(
                recordsResult({ records: RECORDS }),
            )

            renderHook(() =>
                useTransactionHistoryRows({
                    accountAddress: '0xabc',
                    scope: ETH_SCOPE,
                }),
            )

            expect(useKnownAddresses).toHaveBeenCalledWith({
                scope: ETH_SCOPE,
                senderAddress: '0xabc',
                isEnabled: true,
                isSenderHistoryOnly: true,
            })
            expect(useSuspectedPoisoningQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountAddress: '0xabc',
                    knownAddresses: KNOWN,
                    entries: RECORDS.map(({ id, summary, initiator }) => ({
                        id,
                        summary,
                        initiator,
                    })),
                }),
            )
        })

        it('summarises cached rows for the check', () => {
            vi.mocked(hasCachedHistoryRows).mockReturnValue(true)
            const summary = { kind: 'transfer', direction: 'in' }
            vi.mocked(summarizeHistoryItem).mockReturnValue(summary as never)
            const transaction = {
                id: 'TX1',
                roundTime: 1_704_067_200,
            } as TransactionHistoryItem
            vi.mocked(useTransactionHistoryQuery).mockReturnValue(
                historyResult({ transactions: [transaction] }),
            )

            renderHook(() =>
                useTransactionHistoryRows({
                    accountAddress: 'ALGO',
                    scope: { chainId: 'algorand', networkId: 'mainnet' },
                }),
            )

            expect(summarizeHistoryItem).toHaveBeenCalledWith(
                transaction,
                'ALGO',
                'algorand',
            )
            expect(useSuspectedPoisoningQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    entries: [{ id: 'TX1', summary }],
                }),
            )
        })

        it('marks an entry without moving or dropping any row', () => {
            vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
            vi.mocked(useTransactionRecordsQuery).mockReturnValue(
                recordsResult({ records: RECORDS }),
            )
            const { result, rerender } = renderHook(() =>
                useTransactionHistoryRows({
                    accountAddress: '0xabc',
                    scope: ETH_SCOPE,
                }),
            )
            const unmarkedRows = result.current.rows

            vi.mocked(useSuspectedPoisoningQuery).mockReturnValue({
                data: new Map([[SUSPECTED.transactionId, SUSPECTED]]),
            })
            rerender()

            expect(result.current.rows).toEqual(unmarkedRows)
            expect(
                result.current.suspectedPoisoningById.get('0xpoison'),
            ).toEqual(SUSPECTED)
        })
    })
})
