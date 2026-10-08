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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'

const {
    mockTakeTabResumeIntent,
    mockTakeTabResumeResult,
    mockSetSelectedAccountAddress,
    mockOpenSendFunds,
    mockSuccessToast,
    surfaceState,
} = vi.hoisted(() => ({
    mockTakeTabResumeIntent: vi.fn(),
    mockTakeTabResumeResult: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
    mockOpenSendFunds: vi.fn(),
    mockSuccessToast: vi.fn(),
    surfaceState: { current: 'popup' as string },
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    takeTabResumeIntent: () => mockTakeTabResumeIntent(),
    takeTabResumeResult: () => mockTakeTabResumeResult(),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => surfaceState.current,
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ successToast: mockSuccessToast }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [{ address: 'LEDGER_ADDR' }],
    useSelectedAccountAddress: () => ({
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
}))

vi.mock('@modules/deeplink', () => ({
    useSendFundsDeeplink: () => mockOpenSendFunds,
}))

import { capabilityState } from '@test-utils/capability-mock'
import {
    TAB_RESUME_MAX_AGE_MS,
    TAB_RESUME_RESULT_MAX_AGE_MS,
    useTabResume,
    useTabResumeResultToast,
} from '../useTabResume.web'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('useTabResume (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capabilityState.reset()
    })

    it('does not reopen a swap while the swap capability is off', async () => {
        capabilityState.turnOff('swap')
        mockTakeTabResumeIntent.mockResolvedValue({
            flow: 'swap',
            accountAddress: 'LEDGER_ADDR',
            assetInId: '0',
            assetOutId: '31566704',
            payAmount: '2.5',
            createdAt: Date.now(),
        })
        const navigate = vi.fn()

        const { result } = renderHook(() => useTabResume(navigate))
        result.current()
        await flush()

        expect(navigate).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
    })

    it('reopens the swap on the same account with its pair and amount', async () => {
        mockTakeTabResumeIntent.mockResolvedValue({
            flow: 'swap',
            accountAddress: 'LEDGER_ADDR',
            assetInId: '0',
            assetOutId: '31566704',
            payAmount: '2.5',
            createdAt: Date.now(),
        })
        const navigate = vi.fn()
        const { result } = renderHook(() => useTabResume(navigate))

        result.current()

        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Swap',
                params: {
                    assetInId: '0',
                    assetOutId: '31566704',
                    payAmount: '2.5',
                },
            }),
        )
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'LEDGER_ADDR',
        )
        expect(
            mockSetSelectedAccountAddress.mock.invocationCallOrder[0],
        ).toBeLessThan(navigate.mock.invocationCallOrder[0])
    })

    it('reopens the send sheet prefilled with asset, amount, recipient and note', async () => {
        mockTakeTabResumeIntent.mockResolvedValue({
            flow: 'send',
            accountAddress: 'LEDGER_ADDR',
            assetId: '0',
            destination: 'RECEIVER',
            amount: '1.25',
            note: 'rent',
            createdAt: Date.now(),
        })
        const { result } = renderHook(() => useTabResume(vi.fn()))

        result.current()

        await waitFor(() =>
            expect(mockOpenSendFunds).toHaveBeenCalledWith({
                assetId: '0',
                destination: 'RECEIVER',
                amount: new Decimal('1.25'),
                note: 'rent',
                shouldContinueToConfirm: true,
            }),
        )
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'LEDGER_ADDR',
        )
    })

    it.each([
        [
            'an expired hand-over',
            {
                flow: 'send',
                accountAddress: 'LEDGER_ADDR',
                assetId: '0',
                destination: 'RECEIVER',
                amount: '1',
                createdAt: Date.now() - TAB_RESUME_MAX_AGE_MS - 1,
            },
        ],
        [
            'an account no longer in the wallet',
            {
                flow: 'send',
                accountAddress: 'REMOVED_ADDR',
                assetId: '0',
                destination: 'RECEIVER',
                amount: '1',
                createdAt: Date.now(),
            },
        ],
        [
            'a malformed record',
            {
                flow: 'swap',
                accountAddress: 'LEDGER_ADDR',
                createdAt: Date.now(),
            },
        ],
        ['nothing handed over', null],
    ])('opens nothing for %s', async (_label, stored) => {
        mockTakeTabResumeIntent.mockResolvedValue(stored)
        const navigate = vi.fn()
        const { result } = renderHook(() => useTabResume(navigate))

        result.current()
        await flush()

        expect(navigate).not.toHaveBeenCalled()
        expect(mockOpenSendFunds).not.toHaveBeenCalled()
        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
    })
})

describe('useTabResumeResultToast (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        surfaceState.current = 'popup'
    })

    it("shows the finished flow's success toast in the reopened popup", async () => {
        mockTakeTabResumeResult.mockResolvedValue({
            title: 'Swap Complete',
            body: 'ALGO to USDC swap successfully completed',
            createdAt: Date.now(),
        })

        renderHook(() => useTabResumeResultToast())

        await waitFor(() =>
            expect(mockSuccessToast).toHaveBeenCalledWith(
                'Swap Complete',
                'ALGO to USDC swap successfully completed',
            ),
        )
    })

    it('leaves the result alone outside the toolbar popup', async () => {
        surfaceState.current = 'expanded'

        renderHook(() => useTabResumeResultToast())
        await flush()

        expect(mockTakeTabResumeResult).not.toHaveBeenCalled()
    })

    it('drops a result from a popup the browser never reopened', async () => {
        mockTakeTabResumeResult.mockResolvedValue({
            title: 'Swap Complete',
            body: 'done',
            createdAt: Date.now() - TAB_RESUME_RESULT_MAX_AGE_MS - 1,
        })

        renderHook(() => useTabResumeResultToast())
        await flush()

        expect(mockSuccessToast).not.toHaveBeenCalled()
    })
})
