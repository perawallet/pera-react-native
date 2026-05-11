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
import type { SigningPipelineEvent } from '@perawallet/wallet-core-signing'

let capturedOnEvent: ((event: SigningPipelineEvent) => void) | undefined

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: ({
        onEvent,
    }: {
        onEvent?: (event: SigningPipelineEvent) => void
    }) => {
        capturedOnEvent = onEvent
        return {}
    },
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

describe('useMultisigProposeListener', () => {
    beforeEach(() => {
        capturedOnEvent = undefined
        openSheetMock.mockClear()
        invalidateInboxMock.mockClear()
    })

    it('opens the sheet and invalidates inbox on a `proposed` event with a non-confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'proposed',
                signRequestId: SIGN_REQUEST_ID,
                status: 'pending',
            },
        })

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet and invalidates inbox on a `signatures-added` event with a non-confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'signatures-added',
                signRequestId: SIGN_REQUEST_ID,
                status: 'pending',
            },
        })

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('invalidates inbox but does not open the sheet on a `proposed` event with confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'proposed',
                signRequestId: SIGN_REQUEST_ID,
                status: 'confirmed',
            },
        })

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('invalidates inbox but does not open the sheet on a `signatures-added` event with confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'signatures-added',
                signRequestId: SIGN_REQUEST_ID,
                status: 'confirmed',
            },
        })

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('ignores unrelated transport result types like `submitted` and `callback-sent`', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'submitted',
                txIds: ['tx-1'],
            },
        })

        capturedOnEvent?.({
            type: 'signing_completed',
            transportResult: {
                type: 'callback-sent',
                requestId: 'wc-1',
            },
        })

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })

    it('ignores non-completion pipeline events', () => {
        renderHook(() => useMultisigProposeListener())

        capturedOnEvent?.({ type: 'signing_rejected' })
        capturedOnEvent?.({ type: 'transport_started' })

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })
})
