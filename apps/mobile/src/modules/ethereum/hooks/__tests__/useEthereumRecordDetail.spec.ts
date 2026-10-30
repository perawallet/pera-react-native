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
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    i18nKey,
    type TransactionNative,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useTransactionRecordDetailQuery } from '@perawallet/wallet-core-transactions'
import { useEthereumRecordDetail } from '../useEthereumRecordDetail'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapability: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    useTransactionRecordDetailQuery: vi.fn(),
}))

const HASH = `0x${'ab'.repeat(32)}`
const OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const STRANGER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const ACCOUNT = { id: 'owner' } as WalletAccount
const view = (overrides: Record<string, unknown> = {}): TransactionNative => ({
    family: 'evm',
    transaction: {
        kind: 'contract-call',
        from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        value: new Decimal(0),
        data: '0x',
        isMined: true,
        call: {
            kind: 'set-approval-for-all',
            contract: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
            operator: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            isApproved: true,
        },
        ...overrides,
    },
})
const NATIVE = view()

const record = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: HASH,
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    initiator: OWNER,
    summary: {
        kind: 'contract-call',
        title: { key: i18nKey('transactions.list_item.contract_call') },
        direction: 'none',
        icon: 'contract-call',
    },
    chainData: { family: 'evm' },
    ...overrides,
})

const query = (overrides: Record<string, unknown> = {}) =>
    vi.mocked(useTransactionRecordDetailQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        isPaused: false,
        error: null,
        refetch: vi.fn(),
        ...overrides,
    })

const lastParams = () =>
    vi.mocked(useTransactionRecordDetailQuery).mock.calls.at(-1)![0]

describe('useEthereumRecordDetail', () => {
    beforeEach(() => {
        vi.mocked(useFindAccountByAddress).mockImplementation(address =>
            address.toLowerCase() === OWNER.toLowerCase() ? ACCOUNT : null,
        )
        vi.mocked(useChainCapability).mockReturnValue(true)
        query()
    })

    it('reads the transaction from the node for a mined row on a chain that decodes, and returns what it reads', () => {
        query({ data: NATIVE })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(useChainCapability).toHaveBeenCalledWith(
            'ethereum',
            'contractDecoding',
        )
        expect(lastParams()).toMatchObject({
            transactionId: HASH,
            isEnabled: true,
        })
        expect(result.current).toEqual({
            transaction: NATIVE,
            isLoading: false,
            isReadFailed: false,
            isDecoding: true,
        })
    })

    it('reads a failed transaction too', () => {
        renderHook(() => useEthereumRecordDetail(record({ status: 'failed' })))

        expect(lastParams().isEnabled).toBe(true)
    })

    it('reads nothing while contractDecoding is off, and returns nothing even if a copy is cached', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)
        query({ data: NATIVE })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(lastParams().isEnabled).toBe(false)
        expect(result.current).toEqual({
            transaction: null,
            isLoading: false,
            isReadFailed: false,
            isDecoding: false,
        })
    })

    it.each([
        ['a withdrawal', { id: 'withdrawal:42' }],
        ['a pending send', { status: 'pending' as const }],
        ['a replaced send', { status: 'replaced' as const }],
    ])('reads nothing for %s', (_, overrides) => {
        const { result } = renderHook(() =>
            useEthereumRecordDetail(record(overrides)),
        )

        expect(lastParams().isEnabled).toBe(false)
        expect(result.current.isReadFailed).toBe(false)
    })

    it.each(['in', 'out', 'self', 'none'] as const)(
        "reads a %s entry another party initiated for nothing, so it never reads as the account's own",
        direction => {
            const { result } = renderHook(() =>
                useEthereumRecordDetail(
                    record({
                        initiator: STRANGER,
                        summary: { ...record().summary, direction },
                    }),
                ),
            )

            expect(lastParams().isEnabled).toBe(false)
            expect(result.current.transaction).toBeNull()
        },
    )

    it('reads nothing for a row whose initiator the history does not say', () => {
        renderHook(() =>
            useEthereumRecordDetail(record({ initiator: undefined })),
        )

        expect(lastParams().isEnabled).toBe(false)
    })

    it('reads an entry the wallet initiated, whatever its direction', () => {
        renderHook(() =>
            useEthereumRecordDetail(
                record({ summary: { ...record().summary, direction: 'out' } }),
            ),
        )

        expect(lastParams().isEnabled).toBe(true)
    })

    it('reads nothing for a plain value transfer, which has no calldata', () => {
        renderHook(() =>
            useEthereumRecordDetail(
                record({
                    summary: { ...record().summary, kind: 'transfer' },
                }),
            ),
        )

        expect(lastParams().isEnabled).toBe(false)
    })

    it('keeps the record when the node copy is a contract call that decodes to nothing', () => {
        query({ data: view({ call: undefined }) })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(result.current).toMatchObject({
            transaction: null,
            isReadFailed: false,
        })
    })

    it('returns a copy that is not a contract call, which the record does not already say', () => {
        const transfer = view({ kind: 'transfer', call: undefined })
        query({ data: transfer })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(result.current.transaction).toBe(transfer)
    })

    it('says it is loading while the node answers', () => {
        query({ isLoading: true })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(result.current.isLoading).toBe(true)
    })

    it.each([
        ['the read errors', { isError: true }],
        ['the read is paused offline', { isPaused: true }],
    ])('flags a failed read when %s', (_, state) => {
        query(state)

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(result.current).toMatchObject({
            transaction: null,
            isReadFailed: true,
        })
    })

    it('is not a failed read when the copy is already cached', () => {
        query({ data: NATIVE, isPaused: true })

        const { result } = renderHook(() => useEthereumRecordDetail(record()))

        expect(result.current.isReadFailed).toBe(false)
    })
})
