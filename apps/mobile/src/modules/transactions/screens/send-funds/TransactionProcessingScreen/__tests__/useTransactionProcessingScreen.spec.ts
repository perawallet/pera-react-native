/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTransactionProcessingScreen } from '../useTransactionProcessingScreen'
import {
    UserRejectedSigningError,
    type TransportResult,
} from '@perawallet/wallet-core-signing'

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@react-navigation/stack', () => ({}))

const { mockExecute, mockOnFinished, lastTransportResultMock } = vi.hoisted(
    () => ({
        mockExecute: vi.fn(),
        mockOnFinished: vi.fn(),
        lastTransportResultMock: {
            current: null as TransportResult | null,
        },
    }),
)

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: () => ({
        execute: mockExecute,
    }),
}))

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
        getMessage: (_err: unknown) => ({ title: 'Error', body: 'error body' }),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: vi.fn(() => ({
            address: 'test-address',
            name: 'Test',
        })),
        useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
    }
})

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: vi.fn(() => ({ data: new Map() })),
    }
})

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: () => ({
        selectedAssetId: '0',
        amount: undefined,
        destination: 'dest-address',
        note: undefined,
        sendMode: 'normal' as const,
        arc59Summary: undefined,
        isCloseAccount: false,
        onFinished: mockOnFinished,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useLastTransportResult: () => lastTransportResultMock.current,
    }
})

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: { error: vi.fn() },
    }
})

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

const proposedResult = (
    overrides: Partial<Extract<TransportResult, { type: 'proposed' }>> = {},
): TransportResult => ({
    type: 'proposed',
    signRequestId: 'sr-1',
    status: 'pending',
    ...overrides,
})

describe('useTransactionProcessingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        lastTransportResultMock.current = null
    })

    it('calls navigation.goBack and does not show an error toast when user cancels the signing overlay', async () => {
        mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

        renderHook(() => useTransactionProcessingScreen())

        // Allow microtasks to flush
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockGoBack).toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast and navigates back when execution fails with a non-cancel error', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Network error'))

        renderHook(() => useTransactionProcessingScreen())

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockGoBack).toHaveBeenCalled()
    })

    it('exits the send-funds flow via onFinished when lastTransportResult transitions to a `proposed` result', () => {
        // execute() never settles for multisig propose; the hook must rely
        // on the lastTransportResult store change to know when to leave the
        // screen.
        mockExecute.mockReturnValue(new Promise(() => {}))

        const { rerender } = renderHook(() => useTransactionProcessingScreen())

        lastTransportResultMock.current = proposedResult()
        rerender()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
        expect(mockGoBack).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('does not call onFinished on a non-proposed transport result', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))

        const { rerender } = renderHook(() => useTransactionProcessingScreen())

        lastTransportResultMock.current = {
            type: 'submitted',
            txIds: ['tx-1'],
        } as TransportResult
        rerender()

        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it('only exits once even if rerender observes the same proposed result repeatedly', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))

        const { rerender } = renderHook(() => useTransactionProcessingScreen())

        lastTransportResultMock.current = proposedResult()
        rerender()
        rerender()
        rerender()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
    })

    it('does not exit when a stale lastTransportResult is already present at mount', () => {
        // Simulates re-entering the send-funds flow with a leftover propose
        // result in the store from a prior in-session send.
        mockExecute.mockReturnValue(new Promise(() => {}))
        lastTransportResultMock.current = proposedResult()

        renderHook(() => useTransactionProcessingScreen())

        expect(mockOnFinished).not.toHaveBeenCalled()
    })
})
