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

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolveAssetInboxBatchParams } from '@perawallet/wallet-core-transactions'
import { useBulkClaimProcessingScreen } from '../useBulkClaimProcessingScreen'

const mocks = vi.hoisted(() => ({
    params: {
        mode: 'claim' as 'claim' | 'reject',
        assetIndexes: [0, 1],
        scope: { chainId: 'algorand', networkId: 'mainnet' },
    },
    account: { id: 'acct-1' } as unknown,
    goBack: vi.fn(),
    resolve: vi.fn(),
    showToast: vi.fn(),
    showError: vi.fn(),
    handleSubmitError: vi.fn(),
    invalidateInbox: vi.fn(),
    invalidateBalances: vi.fn(),
    assetRequests: [] as unknown[],
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: mocks.goBack }),
    useRoute: () => ({ params: mocks.params }),
}))

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useFindAccountByAddress: () => mocks.account,
    useAccountBalancesInvalidator: () => ({
        invalidate: mocks.invalidateBalances,
    }),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: mocks.invalidateInbox }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetInboxBatchResolution: () => ({ resolve: mocks.resolve }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useTransactionOutcomeHaptics', () => ({
    useTransactionOutcomeHaptics: () => ({
        handleSubmitError: mocks.handleSubmitError,
    }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        assetRequests: mocks.assetRequests,
        accountAddress: 'ALGO_ADDR',
    }),
}))

const request = (assetId: string) => ({
    id: assetId,
    asset: { assetId, name: `Asset ${assetId}` },
})

// Plays the batch the way the package hook does: each item's statuses, then the result.
const resolveWith =
    (outcome: string[]) =>
    async ({ onStatus }: ResolveAssetInboxBatchParams) => {
        outcome.forEach((status, position) => {
            onStatus(position, 'sending')
            onStatus(position, status as 'done' | 'failed')
        })
        const failedCount = outcome.filter(status => status === 'failed').length
        return {
            doneCount: outcome.length - failedCount,
            failedCount,
            firstError: failedCount > 0 ? new Error('overspend') : null,
            isCancelled: false,
        }
    }

describe('useBulkClaimProcessingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.params.mode = 'claim'
        mocks.account = { id: 'acct-1' }
        mocks.assetRequests = [request('1'), request('2')]
    })

    it('resolves the picked requests for the account and returns to the list once all succeed', async () => {
        mocks.resolve.mockImplementation(resolveWith(['done', 'done']))

        const { result } = renderHook(() => useBulkClaimProcessingScreen())

        await waitFor(() => expect(mocks.goBack).toHaveBeenCalled())
        expect(mocks.resolve).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'claim',
                sender: mocks.account,
                requests: mocks.assetRequests,
            }),
        )
        expect(result.current.items.map(item => item.status)).toEqual([
            'done',
            'done',
        ])
        expect(mocks.invalidateInbox).toHaveBeenCalled()
        expect(mocks.invalidateBalances).toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'asset_inbox.requests.bulk_claimed_toast',
                type: 'success',
            }),
        )
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    it('explains a failure and stays on screen until Done', async () => {
        mocks.resolve.mockImplementation(resolveWith(['done', 'failed']))

        const { result } = renderHook(() => useBulkClaimProcessingScreen())

        await waitFor(() => expect(result.current.hasFailed).toBe(true))
        expect(mocks.showToast).not.toHaveBeenCalled()
        expect(mocks.handleSubmitError).toHaveBeenCalledWith(expect.any(Error))
        expect(mocks.showError).toHaveBeenCalledWith(
            expect.any(Error),
            'asset_inbox.bulk.failed_title',
        )
        expect(result.current.title).toBe('asset_inbox.bulk.failed_title')
        expect(mocks.goBack).not.toHaveBeenCalled()

        act(() => result.current.handleDone())

        expect(mocks.goBack).toHaveBeenCalled()
    })

    it('shows no success toast when nothing went through', async () => {
        mocks.resolve.mockImplementation(resolveWith(['failed', 'failed']))

        const { result } = renderHook(() => useBulkClaimProcessingScreen())

        await waitFor(() => expect(result.current.hasFailed).toBe(true))
        expect(mocks.showToast).not.toHaveBeenCalled()
        expect(mocks.showError).toHaveBeenCalled()
    })

    it('leaves with an error instead of hanging when the batch throws', async () => {
        const failure = new Error('unexpected')
        mocks.resolve.mockRejectedValueOnce(failure)

        renderHook(() => useBulkClaimProcessingScreen())

        await waitFor(() => expect(mocks.goBack).toHaveBeenCalled())
        expect(mocks.showError).toHaveBeenCalledWith(failure)
        expect(mocks.invalidateInbox).toHaveBeenCalled()
    })

    it('goes straight back without sending when the account is gone', async () => {
        mocks.account = undefined

        renderHook(() => useBulkClaimProcessingScreen())

        await waitFor(() => expect(mocks.goBack).toHaveBeenCalled())
        expect(mocks.resolve).not.toHaveBeenCalled()
    })
})
