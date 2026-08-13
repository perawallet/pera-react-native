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
    signingEventBus,
    type TransportResult,
} from '@perawallet/wallet-core-signing'

const { sheetStateMock, openSheetMock } = vi.hoisted(() => ({
    sheetStateMock: { current: { signRequestId: null as string | null } },
    openSheetMock: vi.fn(),
}))
vi.mock('../../stores/usePendingSignaturesSheetStore', () => {
    openSheetMock.mockImplementation((id: string) => {
        sheetStateMock.current.signRequestId = id
    })
    const stub = ((
        selector: (state: { openSheet: typeof openSheetMock }) => unknown,
    ) => selector({ openSheet: openSheetMock })) as unknown as {
        getState: () => { signRequestId: string | null }
    }
    stub.getState = () => ({
        signRequestId: sheetStateMock.current.signRequestId,
    })
    return { usePendingSignaturesSheetStore: stub }
})

const { deleteDraftMock } = vi.hoisted(() => ({
    deleteDraftMock: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-multisig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-multisig')
        >()
    const stub = (() => ({ deleteDraft: deleteDraftMock })) as unknown as {
        getState: () => { deleteDraft: typeof deleteDraftMock }
    }
    stub.getState = () => ({ deleteDraft: deleteDraftMock })
    return {
        ...actual,
        useDraftSignRequestStore: stub,
    }
})

const invalidateInboxMock = vi.fn()
vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: invalidateInboxMock }),
}))

const pendingSignRequestsMock = vi.fn<() => unknown[]>(() => [])
vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        useSigningRequest: () => ({
            pendingSignRequests: pendingSignRequestsMock(),
        }),
    }
})

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
        sheetStateMock.current.signRequestId = null
        openSheetMock.mockClear()
        invalidateInboxMock.mockClear()
        deleteDraftMock.mockClear()
        pendingSignRequestsMock.mockReturnValue([])
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

    it('holds the sheet (but still invalidates inbox) while a sibling cosign for the same request is queued', () => {
        // Device holds 2+ participants: cosign-2 is still queued when
        // cosign-1 resolves. Opening the progress sheet now would bury
        // cosign-2's review sheet and strand the user on a no-op Sign button.
        pendingSignRequestsMock.mockReturnValue([
            {
                id: 'cosign-2',
                type: 'transactions',
                txs: [],
                sourceType: 'multisig-cosign',
                signRequestId: SIGN_REQUEST_ID,
            },
        ])

        renderHook(() => useMultisigProposeListener())
        publishTransportResult(signaturesAddedResult(), 'cosign-1')

        expect(openSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet when the only queued entry is the cosign that just resolved', () => {
        // The lifecycle publishes the bus event BEFORE removing the request
        // from the queue, so the completed cosign still appears there — it
        // must not count as a sibling or the last cosign never opens the sheet.
        pendingSignRequestsMock.mockReturnValue([
            {
                id: 'cosign-1',
                type: 'transactions',
                txs: [],
                sourceType: 'multisig-cosign',
                signRequestId: SIGN_REQUEST_ID,
            },
        ])

        renderHook(() => useMultisigProposeListener())
        publishTransportResult(signaturesAddedResult(), 'cosign-1')

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
    })

    it('opens the sheet when the queued cosign targets a different sign request', () => {
        pendingSignRequestsMock.mockReturnValue([
            {
                id: 'cosign-other',
                type: 'transactions',
                txs: [],
                sourceType: 'multisig-cosign',
                signRequestId: 'sr-OTHER',
            },
        ])

        renderHook(() => useMultisigProposeListener())
        publishTransportResult(signaturesAddedResult(), 'cosign-1')

        expect(openSheetMock).toHaveBeenCalledTimes(1)
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID)
    })

    it('opens the sheet at the result signRequestId (draft reconciliation is owned by usePendingSignaturesSheet)', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'

        renderHook(() => useMultisigProposeListener())

        publishTransportResult(
            signaturesAddedResult({ signRequestId: 'sr-real' }),
        )

        expect(openSheetMock).toHaveBeenCalledWith('sr-real')
        expect(deleteDraftMock).toHaveBeenCalledWith('draft-abc')
    })
})
