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
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useReplaceTransaction } from '../useReplaceTransaction'

const mocks = vi.hoisted(() => ({
    isReplaceable: true,
    isBlocked: false,
    replace: vi.fn(),
    fill: vi.fn(),
    request: vi.fn(),
    showError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useReplaceableTransactionQuery: () => ({
        isReplaceable: mocks.isReplaceable,
    }),
    useReplaceTransactionMutation: () => ({
        replace: mocks.replace,
        isPending: false,
    }),
    useBlockingGapQuery: () => ({ isBlocked: mocks.isBlocked }),
    useFillNonceGapMutation: () => ({ fill: mocks.fill, isPending: false }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('../../../components/ReplaceTransactionContent', () => ({
    ReplaceTransactionContent: () => null,
}))

const RECORD: TransactionRecord = {
    id: '0xpending',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'pending',
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transactions.list_item.send') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
}

const render = (record?: TransactionRecord) =>
    renderHook(() => useReplaceTransaction(record)).result.current

describe('useReplaceTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isReplaceable = true
        mocks.isBlocked = false
        mocks.replace.mockResolvedValue(undefined)
        mocks.fill.mockResolvedValue(undefined)
    })

    it('reports whether the record can be re-priced', () => {
        expect(render(RECORD).canReplace).toBe(true)

        mocks.isReplaceable = false
        expect(render(RECORD).canReplace).toBe(false)
    })

    it.each(['speed-up', 'cancel'] as const)(
        'queues a %s of the record once the user picks it',
        async kind => {
            mocks.request.mockResolvedValue({ kind })

            await render(RECORD).handleReplace()

            expect(mocks.replace).toHaveBeenCalledWith({
                scope: RECORD.scope,
                txId: '0xpending',
                kind,
            })
        },
    )

    it('does nothing when the sheet is dismissed', async () => {
        mocks.request.mockResolvedValue(undefined)

        await render(RECORD).handleReplace()

        expect(mocks.replace).not.toHaveBeenCalled()
    })

    it('shows why the replacement could not be built', async () => {
        const error = new Error('no longer pending')
        mocks.request.mockResolvedValue({ kind: 'cancel' })
        mocks.replace.mockRejectedValue(error)

        await render(RECORD).handleReplace()

        expect(mocks.showError).toHaveBeenCalledWith(error)
    })

    it('offers unblock in the sheet when an earlier transaction blocks the record', async () => {
        mocks.isBlocked = true
        mocks.request.mockResolvedValue(undefined)

        const { isBlocked, handleReplace } = render(RECORD)
        await handleReplace()

        expect(isBlocked).toBe(true)
        expect(mocks.request.mock.calls[0][0].contents.props).toEqual({
            isBlocked: true,
        })
    })

    it('queues a fill of the gap, not a replacement, when the user unblocks', async () => {
        mocks.isBlocked = true
        mocks.request.mockResolvedValue({ kind: 'unblock' })

        await render(RECORD).handleReplace()

        expect(mocks.fill).toHaveBeenCalledWith({
            scope: RECORD.scope,
            txId: '0xpending',
        })
        expect(mocks.replace).not.toHaveBeenCalled()
    })

    it('shows why the gap could not be filled', async () => {
        const error = new Error('gap already filled')
        mocks.request.mockResolvedValue({ kind: 'unblock' })
        mocks.fill.mockRejectedValue(error)

        await render(RECORD).handleReplace()

        expect(mocks.showError).toHaveBeenCalledWith(error)
    })
})
