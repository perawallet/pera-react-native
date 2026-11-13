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
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    TokenApproval,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { transferChainAdapters } from '../../transfer-adapter'
import { getTokenApprovalsQueryKey } from '../querykeys'
import { useRevokeTokenApprovalMutation } from '../useRevokeTokenApprovalMutation'

const mocks = vi.hoisted(() => {
    class UserRejectedSigningError extends Error {}
    return {
        UserRejectedSigningError,
        addSignRequest: vi.fn(),
        waitForConfirmation: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mocks.addSignRequest }),
    UserRejectedSigningError: mocks.UserRejectedSigningError,
    broadcasterChainAdapters: {
        get: () => ({ waitForConfirmation: mocks.waitForConfirmation }),
    },
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ACCOUNT = '0x00000000000000000000000000000000000000aa'

const APPROVAL: TokenApproval = {
    kind: 'allowance',
    assetRef: { chainId: 'ethereum', assetId: '0xUSDC' },
    spender: '0x00000000000000000000000000000000000000bb',
}

const REVOKE_TX: UnsignedTransaction = {
    scope: SCOPE,
    payload: { nonce: 4 },
    summary: {
        kind: 'approval',
        title: { key: 'transactions.list_item.revoke_approval' },
        direction: 'none',
        icon: 'approval',
    },
    chainData: { family: 'evm' },
}

const build = vi.fn()

type QueuedRequest = {
    approve: (signed: [], submission?: { txIds: string[] }) => Promise<void>
    reject: () => Promise<void>
    error: (error: Error) => Promise<void>
}

const answerWith = (answer: (request: QueuedRequest) => void) =>
    mocks.addSignRequest.mockImplementation((request: QueuedRequest) => {
        queueMicrotask(() => answer(request))
    })

const renderMutation = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRevokeTokenApprovalMutation(OWNER), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
    return { result, invalidate }
}

const OWNER = { scope: SCOPE, account: ACCOUNT }
const params = { ...OWNER, approval: APPROVAL }

describe('useRevokeTokenApprovalMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: SCOPE.chainId,
            build,
            getFeeEstimate: vi.fn(),
            spendableBalance: vi.fn(),
        })
        build.mockResolvedValue([REVOKE_TX])
        mocks.waitForConfirmation.mockResolvedValue(undefined)
    })

    it('queues a revoke for review, then waits for the chain to confirm it', async () => {
        answerWith(request => void request.approve([], { txIds: ['0xhash'] }))
        const { result, invalidate } = renderMutation()

        await result.current.revoke(params)

        expect(build).toHaveBeenCalledWith(
            { kind: 'approval-revoke', account: ACCOUNT, approval: APPROVAL },
            { scope: SCOPE },
        )
        expect(mocks.addSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'transactions',
                transport: 'submit-and-answer',
                sourceType: 'approval-revoke',
                txs: [REVOKE_TX],
            }),
        )
        expect(mocks.waitForConfirmation).toHaveBeenCalledWith(SCOPE, [
            '0xhash',
        ])
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: getTokenApprovalsQueryKey(SCOPE, ACCOUNT),
        })
    })

    it('reports the approval being revoked until the chain confirms it', async () => {
        let confirm: () => void = () => undefined
        mocks.waitForConfirmation.mockReturnValue(
            new Promise<void>(resolve => {
                confirm = resolve
            }),
        )
        answerWith(request => void request.approve([], { txIds: ['0xhash'] }))
        const { result } = renderMutation()

        expect(result.current.revokingApproval).toBeNull()
        const revoking = result.current.revoke(params)

        await waitFor(() =>
            expect(result.current.revokingApproval).toEqual(APPROVAL),
        )
        confirm()
        await revoking
        await waitFor(() => expect(result.current.revokingApproval).toBeNull())
    })

    it('reports the pending revoke to a screen opened after it started', async () => {
        let confirm: () => void = () => undefined
        mocks.waitForConfirmation.mockReturnValue(
            new Promise<void>(resolve => {
                confirm = resolve
            }),
        )
        answerWith(request => void request.approve([], { txIds: ['0xhash'] }))
        const queryClient = new QueryClient()
        const wrap = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
        const first = renderHook(() => useRevokeTokenApprovalMutation(OWNER), {
            wrapper: wrap,
        }).result
        const revoking = first.current.revoke(params)
        const reopened = renderHook(
            () => useRevokeTokenApprovalMutation(OWNER),
            {
                wrapper: wrap,
            },
        ).result

        await waitFor(() =>
            expect(reopened.current.revokingApproval).toEqual(APPROVAL),
        )
        confirm()
        await revoking
        await waitFor(() =>
            expect(reopened.current.revokingApproval).toBeNull(),
        )
    })

    it('shows another account’s pending revoke to that account only', async () => {
        let confirm: () => void = () => undefined
        mocks.waitForConfirmation.mockReturnValue(
            new Promise<void>(resolve => {
                confirm = resolve
            }),
        )
        answerWith(request => void request.approve([], { txIds: ['0xhash'] }))
        const queryClient = new QueryClient()
        const wrap = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
        const owner = renderHook(() => useRevokeTokenApprovalMutation(OWNER), {
            wrapper: wrap,
        }).result
        const other = renderHook(
            () =>
                useRevokeTokenApprovalMutation({
                    scope: SCOPE,
                    account: '0x00000000000000000000000000000000000000cc',
                }),
            { wrapper: wrap },
        ).result

        const revoking = owner.current.revoke(params)

        await waitFor(() =>
            expect(owner.current.revokingApproval).toEqual(APPROVAL),
        )
        expect(other.current.revokingApproval).toBeNull()
        confirm()
        await revoking
    })

    it('rejects with the cancellation, and reads nothing again, when the user declines the review', async () => {
        answerWith(request => void request.reject())
        const { result, invalidate } = renderMutation()

        await expect(result.current.revoke(params)).rejects.toBeInstanceOf(
            mocks.UserRejectedSigningError,
        )

        expect(mocks.waitForConfirmation).not.toHaveBeenCalled()
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('rejects with the signing error', async () => {
        const failure = new Error('device refused')
        answerWith(request => void request.error(failure))
        const { result } = renderMutation()

        await expect(result.current.revoke(params)).rejects.toBe(failure)
        expect(mocks.waitForConfirmation).not.toHaveBeenCalled()
    })

    it('reads the list again and rethrows when the chain does not confirm', async () => {
        const failure = new Error('not confirmed in time')
        mocks.waitForConfirmation.mockRejectedValue(failure)
        answerWith(request => void request.approve([], { txIds: ['0xhash'] }))
        const { result, invalidate } = renderMutation()

        await expect(result.current.revoke(params)).rejects.toBe(failure)

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: getTokenApprovalsQueryKey(SCOPE, ACCOUNT),
        })
    })

    it('queues nothing when the intent cannot be built', async () => {
        build.mockRejectedValue(new Error('bad intent'))
        const { result } = renderMutation()

        await expect(result.current.revoke(params)).rejects.toThrow(
            'bad intent',
        )
        expect(mocks.addSignRequest).not.toHaveBeenCalled()
    })
})
