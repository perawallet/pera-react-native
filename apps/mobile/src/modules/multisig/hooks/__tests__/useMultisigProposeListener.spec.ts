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
import { renderHook } from '@testing-library/react'
import type { TransportResult } from '@perawallet/wallet-core-signing'

const { lastTransportResultMock } = vi.hoisted(() => ({
    lastTransportResultMock: { current: null as TransportResult | null },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useLastTransportResult: () => lastTransportResultMock.current,
}))

const openSheetMock = vi.fn()
vi.mock('../../stores/usePendingSignaturesSheetStore', () => ({
    usePendingSignaturesSheetStore: (
        selector: (state: { openSheet: typeof openSheetMock }) => unknown,
    ) => selector({ openSheet: openSheetMock }),
}))

const invalidateInboxMock = vi.fn()
vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: invalidateInboxMock }),
}))

import { useMultisigProposeListener } from '../useMultisigProposeListener'

const SIGN_REQUEST_ID = 'sr-1'

const proposedResult = (
    overrides: Partial<Extract<TransportResult, { type: 'proposed' }>> = {},
): TransportResult => ({
    type: 'proposed',
    signRequestId: SIGN_REQUEST_ID,
    status: 'pending',
    ...overrides,
})

const signaturesAddedResult = (
    overrides: Partial<
        Extract<TransportResult, { type: 'signatures-added' }>
    > = {},
): TransportResult => ({
    type: 'signatures-added',
    signRequestId: SIGN_REQUEST_ID,
    status: 'pending',
    ...overrides,
})

describe('useMultisigProposeListener', () => {
    beforeEach(() => {
        lastTransportResultMock.current = null
        openSheetMock.mockClear()
        invalidateInboxMock.mockClear()
    })

    it('opens the sheet and invalidates inbox when lastTransportResult transitions to a `proposed` non-confirmed result', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        lastTransportResultMock.current = proposedResult()
        rerender()

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet and invalidates inbox on `signatures-added` non-confirmed result', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        lastTransportResultMock.current = signaturesAddedResult()
        rerender()

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('invalidates inbox but does not open the sheet on confirmed status', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        lastTransportResultMock.current = proposedResult({
            status: 'confirmed',
        })
        rerender()

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('ignores unrelated transport result types like `submitted` and `callback-sent`', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        lastTransportResultMock.current = {
            type: 'submitted',
            txIds: ['tx-1'],
        } as TransportResult
        rerender()

        lastTransportResultMock.current = {
            type: 'callback-sent',
            requestId: 'wc-1',
        } as TransportResult
        rerender()

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })

    it('does not re-fire when the same transport result reference is observed again', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        const result = proposedResult()
        lastTransportResultMock.current = result
        rerender()
        rerender()
        rerender()

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('fires again when a fresh transport result reference appears', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        lastTransportResultMock.current = proposedResult()
        rerender()
        // New propose with a different sign request — fresh object reference.
        lastTransportResultMock.current = proposedResult({
            signRequestId: 'sr-2',
        })
        rerender()

        expect(openSheetMock).toHaveBeenCalledTimes(2)
        expect(openSheetMock).toHaveBeenNthCalledWith(1, SIGN_REQUEST_ID)
        expect(openSheetMock).toHaveBeenNthCalledWith(2, 'sr-2')
    })

    it('skips a stale transport result that is already present at mount', () => {
        // Stale value from a prior in-session propose — mount should NOT
        // re-open the sheet for it.
        lastTransportResultMock.current = proposedResult()
        renderHook(() => useMultisigProposeListener())

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })
})
