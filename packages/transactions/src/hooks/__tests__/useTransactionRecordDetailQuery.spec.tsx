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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type {
    ChainScope,
    TransactionNative,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { TransactionDetailNotFoundError } from '../../errors'
import { useTransactionRecordDetailQuery } from '../useTransactionRecordDetailQuery'

const mocks = vi.hoisted(() => ({ fetchTransactionDetail: vi.fn() }))

vi.mock('../../history-adapter', () => ({
    fetchTransactionDetail: mocks.fetchTransactionDetail,
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const HASH = `0x${'ab'.repeat(32)}`
const RECORD = { id: HASH, scope: SCOPE } as TransactionRecord
const NATIVE: TransactionNative = { family: 'evm', transaction: {} }

describe('useTransactionRecordDetailQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.resetAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    })

    afterEach(() => queryClient.clear())

    it("reads the record's detail once and serves it from the cache after", async () => {
        mocks.fetchTransactionDetail.mockResolvedValue(NATIVE)
        const params = { scope: SCOPE, transactionId: HASH, record: RECORD }

        const first = renderHook(
            () => useTransactionRecordDetailQuery(params),
            {
                wrapper,
            },
        )
        await waitFor(() => expect(first.result.current.data).toBe(NATIVE))
        const second = renderHook(
            () => useTransactionRecordDetailQuery(params),
            { wrapper },
        )

        expect(second.result.current.data).toBe(NATIVE)
        expect(mocks.fetchTransactionDetail).toHaveBeenCalledTimes(1)
        expect(mocks.fetchTransactionDetail).toHaveBeenCalledWith(
            HASH,
            SCOPE,
            RECORD,
        )
    })

    it('fails when the chain no longer holds the transaction', async () => {
        mocks.fetchTransactionDetail.mockResolvedValue(null)

        const { result } = renderHook(
            () =>
                useTransactionRecordDetailQuery({
                    scope: SCOPE,
                    transactionId: HASH,
                    record: RECORD,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(
            TransactionDetailNotFoundError,
        )
        expect(result.current.data).toBeUndefined()
    })

    it('surfaces a failed read', async () => {
        mocks.fetchTransactionDetail.mockRejectedValue(new Error('offline'))

        const { result } = renderHook(
            () =>
                useTransactionRecordDetailQuery({
                    scope: SCOPE,
                    transactionId: HASH,
                    record: RECORD,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('offline')
    })

    it.each([
        [
            'it is disabled',
            { isEnabled: false, record: RECORD, transactionId: HASH },
        ],
        ['there is no id', { record: RECORD, transactionId: '' }],
    ])('reads nothing when %s', (_, params) => {
        renderHook(
            () => useTransactionRecordDetailQuery({ scope: SCOPE, ...params }),
            { wrapper },
        )

        expect(mocks.fetchTransactionDetail).not.toHaveBeenCalled()
    })
})
