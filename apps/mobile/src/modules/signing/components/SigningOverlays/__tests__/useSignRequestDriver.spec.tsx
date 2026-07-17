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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useSigningPipeline,
    useSigningRequest,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { useSignRequestDriver } from '../useSignRequestDriver'

const { requestBottomSheetMock, dismissMock } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn(() => new Promise(() => {})),
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

vi.mock('../../SignRequestContent', () => ({
    SignRequestContent: () => null,
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(),
        useSigningPipeline: vi.fn(),
    }
})

const headlessRequest = {
    id: 'headless-send',
    type: 'transactions',
    transport: 'callback',
    sourceType: 'local',
} as unknown as SignRequest

const wcRequest = {
    id: 'wc-request',
    type: 'transactions',
    transport: 'callback',
    sourceType: 'walletconnect',
} as unknown as SignRequest

const mockQueue = (
    pending: SignRequest[],
    { hardwareActive = false }: { hardwareActive?: boolean } = {},
) => {
    vi.mocked(useSigningRequest).mockReturnValue({
        pendingSignRequests: pending,
        currentRequest: pending.at(0),
    } as unknown as ReturnType<typeof useSigningRequest>)
    vi.mocked(useSigningPipeline).mockReturnValue({
        resolved: hardwareActive
            ? { activeChild: { kind: 'hardware', snapshot: {} } }
            : { activeChild: null },
    } as unknown as ReturnType<typeof useSigningPipeline>)
}

describe('useSignRequestDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the sheet for the first interactive request', () => {
        mockQueue([wcRequest])

        renderHook(() => useSignRequestDriver())

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })

    it('skips headless requests at the queue head', () => {
        mockQueue([headlessRequest, wcRequest])

        renderHook(() => useSignRequestDriver())

        expect(requestBottomSheetMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })

    it('defers the sheet while a hardware sign is in flight for a different request', () => {
        // A headless Ledger send is parked on the device prompt; the arriving
        // WC request must stay queued — opening its sheet now would stack the
        // review UI over the Ledger overlay bound to the other request.
        mockQueue([headlessRequest, wcRequest], { hardwareActive: true })

        renderHook(() => useSignRequestDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('opens the deferred sheet once the hardware sign settles', () => {
        mockQueue([headlessRequest, wcRequest], { hardwareActive: true })
        const { rerender } = renderHook(() => useSignRequestDriver())
        expect(requestBottomSheetMock).not.toHaveBeenCalled()

        // The headless request completed: it left the queue and the hardware
        // child is gone.
        mockQueue([wcRequest])
        rerender()

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })

    it('keeps the same-request sheet mounted while its own hardware sign runs', () => {
        // The sheet opened for the WC request and the user approved — the
        // hardware child now runs for that same request. The sheet must stay
        // mounted beneath the Ledger overlay (dismissing it collapses the
        // modal stack and tears the overlay down).
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)

        mockQueue([wcRequest], { hardwareActive: true })
        rerender()

        expect(dismissMock).not.toHaveBeenCalled()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    it('dismisses the sheet when the queue drains', () => {
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())

        mockQueue([])
        rerender()

        expect(dismissMock).toHaveBeenCalledWith('wc-request')
    })
})
