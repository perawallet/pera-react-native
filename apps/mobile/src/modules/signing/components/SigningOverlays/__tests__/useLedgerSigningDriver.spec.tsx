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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    useHardwareSigningStore,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { useLedgerSigningDriver } from '../useLedgerSigningDriver'

const { requestBottomSheetMock, dismissMock, pendingRef } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn().mockResolvedValue(undefined),
    dismissMock: vi.fn(),
    pendingRef: { current: [] as SignRequest[] },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: dismissMock,
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: () => ({
            pendingSignRequests: pendingRef.current,
            rejectRequest: vi.fn(),
            retryRequest: vi.fn(),
        }),
    }
})

const interactiveRequest = (id: string): SignRequest =>
    ({
        id,
        type: 'transactions',
        transport: 'algod',
        sourceType: 'walletconnect',
        txs: [],
    }) as unknown as SignRequest

const headlessRequest = (id: string): SignRequest =>
    ({
        id,
        type: 'transactions',
        transport: 'callback',
        sourceType: 'local',
        txs: [],
    }) as unknown as SignRequest

describe('useLedgerSigningDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useHardwareSigningStore.getState().reset()
        pendingRef.current = []
    })

    it('opens the sheet when the active request comes from an interactive source', async () => {
        pendingRef.current = [interactiveRequest('req-1')]
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock.mock.calls[0][0].id).toBe('req-1')
    })

    it('does NOT open the sheet when the active request is headless (sourceType: "local")', () => {
        pendingRef.current = [headlessRequest('req-1')]
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('does NOT open the sheet when the requestId is not in pendingSignRequests yet (race window)', () => {
        pendingRef.current = []
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('opens the sheet on re-render once the interactive request appears in the queue', async () => {
        pendingRef.current = []
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).not.toHaveBeenCalled()

        pendingRef.current = [interactiveRequest('req-1')]
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('dismisses the sheet when the active interactive request leaves the queue (terminal/queue-advance)', async () => {
        // Open: interactive request in queue, store says awaitingApproval
        pendingRef.current = [interactiveRequest('req-1')]
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(dismissMock).not.toHaveBeenCalled()

        // The request leaves pendingSignRequests (queue advanced) while the
        // store still holds the requestId. The gate must close the sheet.
        pendingRef.current = []
        rerender()
        expect(dismissMock).toHaveBeenCalledWith('req-1')
    })
})
