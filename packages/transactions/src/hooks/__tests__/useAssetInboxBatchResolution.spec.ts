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
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import type { AssetInboxRequest } from '../../chain-adapter'
import { useAssetInboxBatchResolution } from '../useAssetInboxBatchResolution'

const mocks = vi.hoisted(() => ({
    execute: vi.fn(),
    remove: vi.fn(),
}))

class FakeLedgerError extends Error {}

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<object>()),
    isLedgerError: (error: unknown) => error instanceof FakeLedgerError,
}))

vi.mock('../useTransactionSendFlow', () => ({
    useTransactionSendFlow: () => ({ execute: mocks.execute }),
}))

vi.mock('../useAssetInboxInvalidator', () => ({
    useAssetInboxInvalidator: () => ({ remove: mocks.remove }),
}))

const scope = { chainId: 'algorand', networkId: 'mainnet' } as const
const sender = { id: 'acct-1' } as WalletAccount

const request = (assetId: string, shouldUseFunds = false) =>
    ({
        asset: { assetId },
        totalAmount: new Decimal(10),
        inboxAddress: 'INBOX',
        shouldUseFundsBeforeClaiming: shouldUseFunds,
        shouldUseFundsBeforeRejecting: shouldUseFunds,
    }) as unknown as AssetInboxRequest

const REQUESTS = [request('1', true), request('2', true), request('3')]

const run = async (mode: 'claim' | 'reject' = 'claim') => {
    const statuses: string[][] = REQUESTS.map(() => [])
    const { result } = renderHook(() => useAssetInboxBatchResolution(scope))
    const outcome = await result.current.resolve({
        mode,
        sender,
        requests: REQUESTS,
        onStatus: (position, status) => statuses[position]!.push(status),
    })
    return { outcome, statuses }
}

const sent = () => mocks.execute.mock.calls.map(([{ params }]) => params)

describe('useAssetInboxBatchResolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('sends each request in turn, moving the inbox funds only with the first that asks', async () => {
        mocks.execute.mockResolvedValue('tx')

        const { outcome, statuses } = await run()

        expect(
            sent().map(params => [
                params.asset.assetId,
                params.shouldClaimAlgo,
            ]),
        ).toEqual([
            ['1', true],
            ['2', false],
            ['3', false],
        ])
        expect(sent()[0]).toMatchObject({
            sendMode: 'claimAssetInbox',
            sender,
            inboxAddress: 'INBOX',
            amount: new Decimal(10),
        })
        expect(statuses).toEqual([
            ['sending', 'done'],
            ['sending', 'done'],
            ['sending', 'done'],
        ])
        expect(outcome).toEqual({
            doneCount: 3,
            failedCount: 0,
            firstError: null,
            isCancelled: false,
        })
        expect(mocks.remove).toHaveBeenCalled()
    })

    it('keeps going past a failure, asks for the inbox funds again with the next request, and returns the first error', async () => {
        const failure = new Error('overspend')
        mocks.execute.mockRejectedValueOnce(failure).mockResolvedValue('tx')

        const { outcome, statuses } = await run()

        expect(sent().map(params => params.shouldClaimAlgo)).toEqual([
            true,
            true,
            false,
        ])
        expect(statuses.map(each => each.at(-1))).toEqual([
            'failed',
            'done',
            'done',
        ])
        expect(outcome).toMatchObject({
            doneCount: 2,
            failedCount: 1,
            firstError: failure,
        })
    })

    it('stops at a declined signature and marks the rest cancelled', async () => {
        mocks.execute
            .mockResolvedValueOnce('tx')
            .mockRejectedValueOnce(new UserRejectedSigningError())

        const { outcome, statuses } = await run()

        expect(mocks.execute).toHaveBeenCalledTimes(2)
        expect(statuses.map(each => each.at(-1))).toEqual([
            'done',
            'cancelled',
            'cancelled',
        ])
        expect(outcome).toMatchObject({
            doneCount: 1,
            isCancelled: true,
            firstError: null,
        })
    })

    it('stops after a Ledger device fault, leaving the rest unsent', async () => {
        const fault = new FakeLedgerError('disconnected')
        mocks.execute.mockRejectedValueOnce(fault)

        const { outcome, statuses } = await run()

        expect(mocks.execute).toHaveBeenCalledTimes(1)
        expect(statuses.map(each => each.at(-1))).toEqual([
            'failed',
            'cancelled',
            'cancelled',
        ])
        expect(outcome).toMatchObject({
            failedCount: 1,
            firstError: fault,
            isCancelled: true,
        })
    })

    it('rejects through the reject send mode', async () => {
        mocks.execute.mockResolvedValue('tx')

        await run('reject')

        expect(
            sent().every(params => params.sendMode === 'rejectAssetInbox'),
        ).toBe(true)
    })
})
