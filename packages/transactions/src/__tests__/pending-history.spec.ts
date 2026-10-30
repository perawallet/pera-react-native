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
import { Decimal } from 'decimal.js'
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    getSubmissionAttemptsWithHistoryEntry,
    type SubmissionAttemptWithHistoryEntry,
    type SubmissionStatus,
} from '@perawallet/wallet-core-signing'
import { historyChainAdapters } from '../history-adapter'
import {
    getPendingTransactionRecords,
    getTransactionHistoryWithPending,
    MAX_PENDING_HISTORY_ROWS,
} from '../pending-history'

vi.mock('@perawallet/wallet-core-signing', () => ({
    getSubmissionAttemptsWithHistoryEntry: vi.fn(),
}))

// The real codec lookup needs a registered chain; the comparison is what matters here.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

const CAPABILITIES = vi.hoisted(() => ({ contractDecoding: true }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainCapabilities: () => CAPABILITIES,
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS = '0xSENDER'
const CREATED_AT = 1_700_000_000_000

const attempt = (
    overrides: Partial<SubmissionAttemptWithHistoryEntry> = {},
): SubmissionAttemptWithHistoryEntry => ({
    id: 'attempt-1',
    network: 'ethereum/mainnet',
    txIds: ['0xhash1'],
    intentKey: null,
    flow: 'pipeline',
    sender: ADDRESS,
    status: 'submitted',
    chainData: null,
    nonce: 0,
    createdAt: CREATED_AT,
    resolvedAt: null,
    rawTransaction: null,
    replacesAttemptId: null,
    historyEntry: {
        summary: {
            kind: 'transfer',
            title: { key: 'transactions.list_item.send' },
            direction: 'out',
            icon: 'send',
        },
        chainData: { family: 'evm' },
        fee: new Decimal('420000000000000'),
    },
    ...overrides,
})

const minedRecord = (
    id: string,
    timestamp = CREATED_AT - 60_000,
): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: 'confirmed',
    timestamp,
    summary: {
        kind: 'transfer',
        title: { key: 'transactions.list_item.send' },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

const ledger = (...attempts: SubmissionAttemptWithHistoryEntry[]) =>
    vi.mocked(getSubmissionAttemptsWithHistoryEntry).mockResolvedValue(attempts)

const pendingRecords = (listedIds: string[] = []) =>
    getPendingTransactionRecords({
        address: ADDRESS,
        scope: SCOPE,
        listedIds: new Set(listedIds),
    })

describe('getPendingTransactionRecords', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        ['submitted', 'pending', 'warning'],
        ['unknown', 'pending', 'warning'],
        ['failed', 'failed', 'error'],
        ['replaced', 'replaced', 'warning'],
    ] as const)(
        'reads a %s attempt as %s with a notice',
        async (status: SubmissionStatus, expected, kind) => {
            ledger(attempt({ status }))

            const [record] = await pendingRecords()

            expect(record.status).toBe(expected)
            expect(record.summary.notice).toMatchObject({ kind })
        },
    )

    it('dates a pending notice from when the attempt was recorded', async () => {
        ledger(attempt())

        const [record] = await pendingRecords()

        expect(record.summary.notice?.since).toBe(CREATED_AT)
        expect(record.timestamp).toBe(CREATED_AT)
    })

    it('keeps a confirmed attempt, without a notice, until the chain lists it', async () => {
        ledger(attempt({ status: 'confirmed' }))

        const [record] = await pendingRecords()

        expect(record.status).toBe('confirmed')
        expect(record.summary.notice).toBeUndefined()
    })

    it("builds the record from the attempt's id, scope, fee and entry", async () => {
        ledger(attempt())

        const [record] = await pendingRecords()

        expect(record).toMatchObject({
            id: '0xhash1',
            scope: SCOPE,
            chainData: { family: 'evm' },
            summary: { title: { key: 'transactions.list_item.send' } },
        })
        expect(record.fee?.toString()).toBe('420000000000000')
    })

    it('leaves out an attempt once the chain lists its transaction', async () => {
        ledger(attempt())

        expect(await pendingRecords(['0xhash1'])).toEqual([])
    })

    it('leaves out a group attempt when any of its transactions is listed', async () => {
        ledger(attempt({ txIds: ['0xfirst', '0xsecond'] }))

        expect(await pendingRecords(['0xsecond'])).toEqual([])
    })

    it('matches the sender through the chain codec, not by string equality', async () => {
        ledger(attempt({ sender: '0xsender' }))

        expect(await pendingRecords()).toHaveLength(1)
    })

    it('leaves out attempts from another sender, with no sender, or with no txids', async () => {
        ledger(
            attempt({ id: 'a', sender: '0xOTHER' }),
            attempt({ id: 'b', sender: null }),
            attempt({ id: 'c', txIds: [] }),
        )

        expect(await pendingRecords()).toEqual([])
    })

    it('lists a hash recorded twice once, with the newest attempt', async () => {
        ledger(
            attempt({ id: 'retry', status: 'unknown' }),
            attempt({ id: 'first', status: 'failed' }),
        )

        const records = await pendingRecords()

        expect(records.map(r => [r.id, r.status])).toEqual([
            ['0xhash1', 'pending'],
        ])
    })

    it('caps the rows', async () => {
        ledger(
            ...Array.from({ length: MAX_PENDING_HISTORY_ROWS + 5 }, (_, i) =>
                attempt({ id: `a${i}`, txIds: [`0x${i}`] }),
            ),
        )

        expect(await pendingRecords()).toHaveLength(MAX_PENDING_HISTORY_ROWS)
    })

    it('says a failed replacement was not needed once the transaction it re-priced confirmed', async () => {
        ledger(
            attempt({
                id: 'speed-up-2',
                txIds: ['0xc'],
                status: 'failed',
                replacesAttemptId: 'speed-up-1',
            }),
            attempt({
                id: 'speed-up-1',
                txIds: ['0xb'],
                status: 'failed',
                replacesAttemptId: 'original',
            }),
            attempt({ id: 'original', txIds: ['0xa'], status: 'confirmed' }),
        )

        const records = await pendingRecords()

        expect(records.map(r => [r.id, r.summary.notice?.title.key])).toEqual([
            ['0xc', 'transactions.notice.replacement_not_needed'],
            ['0xb', 'transactions.notice.replacement_not_needed'],
            ['0xa', undefined],
        ])
    })

    it('keeps a failed replacement as failed when nothing it re-priced confirmed', async () => {
        ledger(
            attempt({
                id: 'speed-up',
                txIds: ['0xb'],
                status: 'failed',
                replacesAttemptId: 'original',
            }),
            attempt({ id: 'original', txIds: ['0xa'], status: 'submitted' }),
        )

        const [replacement] = await pendingRecords()

        expect(replacement.summary.notice?.title.key).toBe(
            'transactions.notice.failed',
        )
    })
})

describe('getTransactionHistoryWithPending', () => {
    const getTransactionHistory = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        historyChainAdapters.reset()
        historyChainAdapters.register({
            chainId: 'ethereum',
            getTransactionHistory,
        })
    })

    it("hands the chain the scope's capabilities with every page read", async () => {
        getTransactionHistory.mockResolvedValue({ items: [] })

        await getTransactionHistoryWithPending(ADDRESS, SCOPE, {
            cursor: 'page-2',
        })

        expect(getTransactionHistory).toHaveBeenCalledWith(
            ADDRESS,
            SCOPE,
            { cursor: 'page-2' },
            { capabilities: CAPABILITIES },
        )
    })

    it("puts the wallet's own broadcasts ahead of page one", async () => {
        ledger(attempt())
        getTransactionHistory.mockResolvedValue({
            items: [minedRecord('0xmined')],
            next: { cursor: 'page-2' },
        })

        const page = await getTransactionHistoryWithPending(ADDRESS, SCOPE)

        expect(page.items.map(record => record.id)).toEqual([
            '0xhash1',
            '0xmined',
        ])
        expect(page.items[0].status).toBe('pending')
        expect(page.minedItems.map(record => record.id)).toEqual(['0xmined'])
        expect(page.next).toEqual({ cursor: 'page-2' })
    })

    it('merges a resolved attempt into page one by time, not ahead of it', async () => {
        ledger(attempt({ status: 'replaced' }))
        getTransactionHistory.mockResolvedValue({
            items: [
                minedRecord('0xnewer', CREATED_AT + 1_000),
                minedRecord('0xolder', CREATED_AT - 1_000),
            ],
        })

        const page = await getTransactionHistoryWithPending(ADDRESS, SCOPE)

        expect(page.items.map(record => record.id)).toEqual([
            '0xnewer',
            '0xhash1',
            '0xolder',
        ])
    })

    it('passes a later page straight through', async () => {
        ledger(attempt())
        const later = { items: [minedRecord('0xolder')] }
        getTransactionHistory.mockResolvedValue(later)

        const page = await getTransactionHistoryWithPending(ADDRESS, SCOPE, {
            cursor: 'page-2',
        })

        expect(page).toEqual({ ...later, minedItems: later.items })
        expect(getSubmissionAttemptsWithHistoryEntry).not.toHaveBeenCalled()
    })

    it('leaves exactly one record once the mined page lists the pending hash', async () => {
        ledger(attempt())
        getTransactionHistory.mockResolvedValue({
            items: [minedRecord('0xhash1')],
        })

        const page = await getTransactionHistoryWithPending(ADDRESS, SCOPE)

        expect(page.items).toHaveLength(1)
        expect(page.items[0].status).toBe('confirmed')
    })

    it('rejects when the mined page does', async () => {
        ledger(attempt())
        getTransactionHistory.mockRejectedValue(new Error('offline'))

        await expect(
            getTransactionHistoryWithPending(ADDRESS, SCOPE),
        ).rejects.toThrow('offline')
    })
})
