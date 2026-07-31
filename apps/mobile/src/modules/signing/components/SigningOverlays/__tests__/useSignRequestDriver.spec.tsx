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

const { requestBottomSheetMock, dismissMock, hostCountState, appLockState } =
    vi.hoisted(() => ({
        requestBottomSheetMock: vi.fn(() => new Promise(() => {})),
        dismissMock: vi.fn(),
        hostCountState: { current: 1 },
        appLockState: { current: false },
    }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: dismissMock,
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
    useBottomSheetStore: (selector: (state: { hostCount: number }) => number) =>
        selector({ hostCount: hostCountState.current }),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useSecurityStore: (
        selector: (state: { isAppLockActive: boolean }) => boolean,
    ) => selector({ isAppLockActive: appLockState.current }),
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
        hostCountState.current = 1
        appLockState.current = false
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

    it('waits for a bottom-sheet host before opening', () => {
        // BottomSheetManager can be unmounted during route-tree swaps
        // (migration/onboarding gates). Requesting a sheet then rejects and
        // previously wedged the queue — the driver must hold the request and
        // open once a host registers.
        hostCountState.current = 0
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()

        hostCountState.current = 1
        rerender()

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })

    it('holds the sheet while the app lock overlay is active, presents on unlock', () => {
        // A dApp request arriving while the auto-lock overlay covers the app
        // must not present into the covered layer — that reads as "entered my
        // PIN, then the TX appeared" in the field (PERA-4743). The unlock
        // flips the flag and the effect re-runs.
        appLockState.current = true
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()

        appLockState.current = false
        rerender()

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
        expect(requestBottomSheetMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })

    it('keeps an already-open sheet mounted across a relock, and still dismisses on queue drain', () => {
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)

        // Relock with the sheet open: leave it mounted (it sits behind the
        // lock overlay), do not churn the bookkeeping.
        appLockState.current = true
        rerender()
        expect(dismissMock).not.toHaveBeenCalled()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)

        // The request settles while still locked (e.g. dApp cancels): the
        // hidden sheet must still be dismissed so it isn't stale on unlock.
        mockQueue([])
        rerender()
        expect(dismissMock).toHaveBeenCalledWith('wc-request')
    })

    it('re-opens the sheet after the host unmounts mid-display', () => {
        mockQueue([wcRequest])
        const { rerender } = renderHook(() => useSignRequestDriver())
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)

        // Last host unmounted: the store force-settled the sheet promise;
        // the request is still pending in the signing queue.
        hostCountState.current = 0
        rerender()
        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)

        hostCountState.current = 1
        rerender()

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(2)
        expect(requestBottomSheetMock).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'wc-request' }),
        )
    })
})
