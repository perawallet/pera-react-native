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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    escrowCardAddress: 'CARD' as string | null,
    owner: { address: 'OWNER' } as unknown,
    pending: null as unknown,
    waitTimeSeconds: 20 as number | null,
    buildRequest: vi.fn(),
    buildWithdraw: vi.fn(),
    buildCancel: vi.fn(),
    invalidatePending: vi.fn(),
    submit: vi.fn(),
    assignFeeToGroup: vi.fn(),
    invalidateQueries: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardStore: (
        selector: (state: { escrowCardAddress: string | null }) => unknown,
    ) => selector({ escrowCardAddress: mocks.escrowCardAddress }),
    useEscrowWithdrawal: () => ({
        buildRequest: mocks.buildRequest,
        buildWithdraw: mocks.buildWithdraw,
        buildCancel: mocks.buildCancel,
    }),
    useCardPendingWithdrawalQuery: () => ({
        pending: mocks.pending,
        waitTimeSeconds: mocks.waitTimeSeconds,
        isLoading: false,
        invalidate: mocks.invalidatePending,
    }),
    useSubmitAndConfirmMutation: () => ({ mutateAsync: mocks.submit }),
}))
vi.mock('@perawallet/wallet-core-signing', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-signing')),
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: mocks.assignFeeToGroup,
    }),
}))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
}))
vi.mock('@tanstack/react-query', async () => ({
    ...(await vi.importActual<object>('@tanstack/react-query')),
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))
vi.mock('../useCardOwnerAccount', () => ({
    useCardOwnerAccount: () => mocks.owner as WalletAccount | null,
}))

import { useCardWithdraw } from '../useCardWithdraw'
import { CardEscrowUnavailableError } from '../useCardManualDeposit'

const nowSeconds = () => Math.floor(Date.now() / 1000)
const pendingCreatedAt = (createdAt: number) => ({
    card: 'CARD',
    recipient: 'OWNER',
    asset: '10458941',
    amount: 250_000n,
    createdAt,
    nonce: 0n,
})

describe('useCardWithdraw', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.escrowCardAddress = 'CARD'
        mocks.owner = { address: 'OWNER' }
        mocks.pending = null
        mocks.waitTimeSeconds = 20
        mocks.buildRequest.mockResolvedValue(['REQ'])
        mocks.buildWithdraw.mockResolvedValue(['WITHDRAW'])
        mocks.buildCancel.mockResolvedValue(['CANCEL'])
        mocks.assignFeeToGroup.mockImplementation(
            async ({ transactions }: { transactions: unknown[] }) => ({
                transactions,
            }),
        )
        mocks.submit.mockResolvedValue({ txIds: ['TX'] })
        mocks.invalidatePending.mockResolvedValue(undefined)
    })

    it('requests a withdrawal from the owner in base units and refreshes the pending state', async () => {
        const { result } = renderHook(() => useCardWithdraw())

        await act(() => result.current.request(new Decimal('0.25')))

        expect(mocks.buildRequest).toHaveBeenCalledWith({
            sender: 'OWNER',
            cardAddress: 'CARD',
            amount: 250_000n,
        })
        expect(mocks.submit).toHaveBeenCalledWith({
            unsignedTxs: ['REQ'],
            source: expect.objectContaining({ name: 'card-withdraw-request' }),
        })
        expect(mocks.invalidatePending).toHaveBeenCalled()
    })

    it('completes the pending request for its stored amount and refreshes both balances', async () => {
        mocks.pending = pendingCreatedAt(nowSeconds() - 60)
        const { result } = renderHook(() => useCardWithdraw())

        await act(() => result.current.complete())

        expect(mocks.buildWithdraw).toHaveBeenCalledWith({
            sender: 'OWNER',
            cardAddress: 'CARD',
            amount: 250_000n,
        })
        expect(mocks.submit).toHaveBeenCalledWith({
            unsignedTxs: ['WITHDRAW'],
            source: expect.objectContaining({ name: 'card-withdraw' }),
        })
        expect(mocks.invalidatePending).toHaveBeenCalled()
        // The card balance is read off the escrow account, so it has to be
        // dropped along with the owner's holdings that just received the funds.
        expect(JSON.stringify(mocks.invalidateQueries.mock.calls)).toContain(
            'CARD',
        )
    })

    it('cancels the pending request', async () => {
        mocks.pending = pendingCreatedAt(nowSeconds())
        const { result } = renderHook(() => useCardWithdraw())

        await act(() => result.current.cancel())

        expect(mocks.buildCancel).toHaveBeenCalledWith({
            sender: 'OWNER',
            cardAddress: 'CARD',
        })
        expect(mocks.submit).toHaveBeenCalledWith({
            unsignedTxs: ['CANCEL'],
            source: expect.objectContaining({ name: 'card-withdraw-cancel' }),
        })
    })

    it('refuses every step without a card owner in the wallet', async () => {
        mocks.owner = null
        const { result } = renderHook(() => useCardWithdraw())

        await expect(
            result.current.request(new Decimal('1')),
        ).rejects.toBeInstanceOf(CardEscrowUnavailableError)
        expect(mocks.submit).not.toHaveBeenCalled()
    })

    it('exposes the pending amount in display units and counts down to readiness', () => {
        mocks.pending = pendingCreatedAt(nowSeconds())
        const { result } = renderHook(() => useCardWithdraw())

        expect(result.current.pendingAmount.toFixed(2)).toBe('0.25')
        expect(result.current.isReady).toBe(false)
        // wait time plus the block-time buffer, give or take the test's own clock.
        expect(result.current.secondsUntilReady).toBeGreaterThanOrEqual(23)
        expect(result.current.secondsUntilReady).toBeLessThanOrEqual(26)
    })

    it('is ready once the wait and buffer have elapsed', () => {
        mocks.pending = pendingCreatedAt(nowSeconds() - 60)
        const { result } = renderHook(() => useCardWithdraw())

        expect(result.current.isReady).toBe(true)
        expect(result.current.secondsUntilReady).toBe(0)
    })

    // Without the wait time the contract would reject `withdraw` anyway, so
    // the UI must not offer Complete.
    it('is never ready while the contract has no wait time set', () => {
        mocks.pending = pendingCreatedAt(nowSeconds() - 60)
        mocks.waitTimeSeconds = null
        const { result } = renderHook(() => useCardWithdraw())

        expect(result.current.isReady).toBe(false)
    })
})
