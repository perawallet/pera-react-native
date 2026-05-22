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
import { useHardwareSigningStore } from '@perawallet/wallet-core-signing'
import { useLedgerSigningDriver } from '../useLedgerSigningDriver'

const { requestBottomSheetMock, dismissMock } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn().mockResolvedValue(undefined),
    dismissMock: vi.fn(),
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
            pendingSignRequests: [],
            rejectRequest: vi.fn(),
            retryRequest: vi.fn(),
        }),
    }
})

describe('useLedgerSigningDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useHardwareSigningStore.getState().reset()
    })

    it('opens the sheet when the hardware-signing store flips to awaitingApproval', () => {
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock.mock.calls[0][0].id).toBe(
            'ledger-signing:req-1',
        )
    })

    it('keeps the sheet closed during the silent BLE-scan phase', () => {
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            // start() sets status='searching' — the silent phase.
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
        })
        rerender()
        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('opens the sheet for the signing phase too', () => {
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('signing')
        })
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('dismisses the sheet when the hardware-signing store resets', () => {
        const { rerender } = renderHook(() => useLedgerSigningDriver())
        act(() => {
            useHardwareSigningStore.getState().start('req-1', 'Nano X')
            useHardwareSigningStore.getState().setStatus('awaitingApproval')
        })
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(dismissMock).not.toHaveBeenCalled()

        act(() => {
            useHardwareSigningStore.getState().reset()
        })
        rerender()
        expect(dismissMock).toHaveBeenCalledWith('ledger-signing:req-1')
    })
})
