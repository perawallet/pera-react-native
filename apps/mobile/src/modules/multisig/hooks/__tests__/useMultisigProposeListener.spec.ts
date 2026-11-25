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

const { sheetStateMock, openSheetMock, enqueueSheetMock } = vi.hoisted(() => ({
    sheetStateMock: { current: { signRequestId: null as string | null } },
    openSheetMock: vi.fn(),
    enqueueSheetMock: vi.fn(),
}))
vi.mock('../../stores/usePendingSignaturesSheetStore', () => {
    openSheetMock.mockImplementation((id: string) => {
        sheetStateMock.current.signRequestId = id
    })
    const stub = ((
        selector: (state: {
            openSheet: typeof openSheetMock
            enqueueSheet: typeof enqueueSheetMock
        }) => unknown,
    ) =>
        selector({
            openSheet: openSheetMock,
            enqueueSheet: enqueueSheetMock,
        })) as unknown as {
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
    return {
        ...actual,
        deleteDraftSignRequest: deleteDraftMock,
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

const fakeRequest = (id: string = SIGN_REQUEST_ID, chainId = 'algorand') =>
    ({ id, type: 'transactions', txs: [], chainId }) as never

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
    chainId = 'algorand',
) => {
    signingEventBus.publish({
        type: 'transport-result',
        request: fakeRequest(requestId, chainId),
        result,
    })
}

describe('useMultisigProposeListener', () => {
    beforeEach(() => {
        signingEventBus.__resetForTests()
        sheetStateMock.current.signRequestId = null
        openSheetMock.mockClear()
        enqueueSheetMock.mockClear()
        invalidateInboxMock.mockClear()
        deleteDraftMock.mockClear()
        pendingSignRequestsMock.mockReturnValue([])
    })

    it('opens the sheet and invalidates inbox when a `proposed` non-confirmed transport-result event is published', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())

        expect(enqueueSheetMock).toHaveBeenCalledTimes(1)
        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'algorand',
        )
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('opens the sheet on the chain of an Ethereum request', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult(), SIGN_REQUEST_ID, 'ethereum')

        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'ethereum',
        )
    })

    it('opens the sheet and invalidates inbox on `signatures-added` non-confirmed result', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(signaturesAddedResult())

        expect(enqueueSheetMock).toHaveBeenCalledTimes(1)
        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'algorand',
        )
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('swaps the draft whose first signature proposed it for the real request, dropping the draft', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        renderHook(() => useMultisigProposeListener())

        signingEventBus.publish({
            type: 'transport-result',
            request: {
                id: 'req-1',
                type: 'transactions',
                txs: [],
                chainId: 'algorand',
                signRequestId: 'draft-abc',
            } as never,
            result: signaturesAddedResult(),
        })

        expect(deleteDraftMock).toHaveBeenCalledWith('draft-abc')
        expect(openSheetMock).toHaveBeenCalledWith(SIGN_REQUEST_ID, 'algorand')
    })

    it("leaves an open draft in place when another request's cosign resolves", () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(signaturesAddedResult())

        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).not.toHaveBeenCalled()
        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'algorand',
        )
    })

    it('invalidates inbox but does not open the sheet on confirmed status', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult({ status: 'confirmed' }))

        expect(enqueueSheetMock).not.toHaveBeenCalled()
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

        expect(enqueueSheetMock).not.toHaveBeenCalled()
        expect(invalidateInboxMock).not.toHaveBeenCalled()
    })

    it('fires once per published event (no duplicate side effects on rerender)', () => {
        const { rerender } = renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())
        rerender()
        rerender()

        expect(enqueueSheetMock).toHaveBeenCalledTimes(1)
        expect(invalidateInboxMock).toHaveBeenCalledTimes(1)
    })

    it('fires again when a fresh transport result for a different request is published', () => {
        renderHook(() => useMultisigProposeListener())

        publishTransportResult(proposedResult())
        publishTransportResult(
            proposedResult({ signRequestId: 'sr-2' }),
            'req-2',
        )

        expect(enqueueSheetMock).toHaveBeenCalledTimes(2)
        expect(enqueueSheetMock).toHaveBeenNthCalledWith(
            1,
            SIGN_REQUEST_ID,
            'algorand',
        )
        expect(enqueueSheetMock).toHaveBeenNthCalledWith(2, 'sr-2', 'algorand')
    })

    it('does not replay events published before mount (no replay option)', () => {
        publishTransportResult(proposedResult())
        renderHook(() => useMultisigProposeListener())

        expect(enqueueSheetMock).not.toHaveBeenCalled()
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

        expect(enqueueSheetMock).not.toHaveBeenCalled()
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

        expect(enqueueSheetMock).toHaveBeenCalledTimes(1)
        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'algorand',
        )
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

        expect(enqueueSheetMock).toHaveBeenCalledTimes(1)
        expect(enqueueSheetMock).toHaveBeenCalledWith(
            SIGN_REQUEST_ID,
            'algorand',
        )
    })
})
