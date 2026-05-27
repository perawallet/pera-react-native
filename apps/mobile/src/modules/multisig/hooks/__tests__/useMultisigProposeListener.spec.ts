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
import {
    signingEventBus,
    type TransportResult,
} from '@perawallet/wallet-core-signing'

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

const fakeRequest = (id: string = SIGN_REQUEST_ID) =>
    ({ id, type: 'transactions' }) as never

const proposedResult = (
    overrides: Partial<Extract<TransportResult, { type: 'proposed' }>> = {},
): TransportResult => ({
    type: 'proposed',
    signRequestId: SIGN_REQUEST_ID,
    status: 'pending',
    sourceType: 'local',
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

const publishTransportResult = (
    result: TransportResult,
    requestId: string = SIGN_REQUEST_ID,
) => {
    signingEventBus.publish({
        type: 'transport-result',
        request: fakeRequest(requestId),
        result,
    })
}

describe('useMultisigProposeListener', () => {
    beforeEach(() => {
        signingEventBus.__resetForTests()
        openSheetMock.mockClear()
        invalidateInboxMock.mockClear()
    })

    it('opens the sheet and invalidates inbox when a `proposed` non-confirmed transport-result event is published', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet and invalidates inbox on `signatures-added` non-confirmed result', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(signaturesAddedResult())

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('invalidates inbox but does not open the sheet on confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult({ status: 'confirmed' }))

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('ignores unrelated transport result types like `submitted` and `callback-sent`', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult({
            type: 'submitted',
            txIds: ['tx-1'],
        } as TransportResult)
        publishTransportResult({
            type: 'callback-sent',
            requestId: 'wc-1',
        } as TransportResult)

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })

    it('fires once per published event (no duplicate side effects on rerender)', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())
        rerender()
        rerender()

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('fires again when a fresh transport result for a different request is published', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())
        publishTransportResult(
            proposedResult({ signRequestId: 'sr-2' }),
            'req-2',
        )

        expect(openSheetMock).toHaveBeenCalledTimes(2)
        expect(openSheetMock).toHaveBeenNthCalledWith(1, SIGN_REQUEST_ID)
        expect(openSheetMock).toHaveBeenNthCalledWith(2, 'sr-2')
    })

    it('does not replay events published before mount (no replay option)', () => {
        publishTransportResult(proposedResult())
        renderHook(() => useMultisigProposeListener())

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })
})
