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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraftSignRequestStore } from '@perawallet/wallet-core-multisig'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { usePendingSignaturesSheetStore } from '../../stores/usePendingSignaturesSheetStore'
import { usePendingSignaturesSheet } from '../usePendingSignaturesSheet'

const createDraft = (): string =>
    useDraftSignRequestStore.getState().createDraft({
        scope: { chainId: 'algorand', networkId: 'testnet' },
        multisigAddress: 'MSIG_ADDRESS',
        multisigDetails: {
            threshold: 2,
            version: 1,
            participantAddresses: ['A', 'B', 'C'],
        },
        rawTransactionsBase64: ['rawTx0base64'],
        proposeType: 'async',
    })

const openDraft = (): string => {
    const draftId = createDraft()
    usePendingSignaturesSheetStore.getState().openSheet(draftId, 'algorand')
    return draftId
}

describe('usePendingSignaturesSheet with the real stores', () => {
    beforeEach(() => {
        useDraftSignRequestStore.getState().resetState()
        usePendingSignaturesSheetStore.getState().resetState()
    })

    it('keeps an open draft when a sign-request link names another request', () => {
        const draftId = openDraft()
        const { result } = renderHook(() => usePendingSignaturesSheet())

        let isShown = true
        act(() => {
            isShown = result.current.showSignRequest('1')
        })

        expect(isShown).toBe(false)
        expect(
            useDraftSignRequestStore.getState().getDraft(draftId),
        ).toBeDefined()
        expect(usePendingSignaturesSheetStore.getState().signRequestId).toBe(
            draftId,
        )
    })

    it('swaps the draft for the request its own propose created', () => {
        const draftId = openDraft()
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.replaceDraft(draftId, 'sr-real', 'algorand'))

        expect(
            useDraftSignRequestStore.getState().getDraft(draftId),
        ).toBeUndefined()
        expect(usePendingSignaturesSheetStore.getState().signRequestId).toBe(
            'sr-real',
        )
    })

    it('keeps another proposed draft available after the visible draft closes', () => {
        vi.mocked(generateOrderedUniqueId)
            .mockReturnValueOnce('visible')
            .mockReturnValueOnce('incoming')
        const visible = openDraft()
        const incoming = createDraft()
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => {
            result.current.enqueueSignRequest(incoming, 'algorand')
            result.current.enqueueSignRequest(incoming, 'algorand')
        })

        const store = usePendingSignaturesSheetStore
        expect(store.getState().signRequestId).toBe(visible)
        expect(store.getState().queued).toEqual([
            {
                signRequestId: incoming,
                chainId: 'algorand',
            },
        ])

        act(() => store.getState().closeSheet())

        expect(store.getState().signRequestId).toBe(incoming)
        expect(store.getState().queued).toEqual([])
        expect(
            useDraftSignRequestStore.getState().getDraft(incoming),
        ).toBeDefined()
    })

    it('skips a queued draft that was deleted before its turn', () => {
        vi.mocked(generateOrderedUniqueId)
            .mockReturnValueOnce('visible')
            .mockReturnValueOnce('gone')
        openDraft()
        const gone = createDraft()
        const store = usePendingSignaturesSheetStore

        act(() => {
            store.getState().enqueueSheet(gone, 'algorand')
            store.getState().enqueueSheet('sr-real', 'algorand')
            useDraftSignRequestStore.getState().deleteDraft(gone)
            store.getState().closeSheet()
        })

        expect(store.getState().signRequestId).toBe('sr-real')
        expect(store.getState().queued).toEqual([])
    })
})
