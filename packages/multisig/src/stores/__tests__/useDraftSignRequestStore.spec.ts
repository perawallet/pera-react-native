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

// The vitest setup globally mocks generateOrderedUniqueId to return a
// constant. Override per-spec so we can verify unique id generation.
const { generateOrderedUniqueIdMock } = vi.hoisted(() => ({
    generateOrderedUniqueIdMock: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: generateOrderedUniqueIdMock,
    }
})

import {
    useDraftSignRequestStore,
    isDraftSignRequestId,
    DRAFT_SIGN_REQUEST_ID_PREFIX,
} from '../useDraftSignRequestStore'

const baseInput = () => ({
    network: 'testnet' as const,
    multisigAddress: 'MSIG_ADDRESS',
    multisigDetails: {
        threshold: 2,
        version: 1,
        participantAddresses: ['A', 'B', 'C'],
    },
    rawTransactionsBase64: ['rawTx0base64'],
    proposeType: 'async' as const,
})

describe('useDraftSignRequestStore', () => {
    beforeEach(() => {
        useDraftSignRequestStore.getState().resetState()
        let counter = 0
        generateOrderedUniqueIdMock.mockReset()
        generateOrderedUniqueIdMock.mockImplementation(() => `uid-${++counter}`)
    })

    it('createDraft returns an id with the draft- prefix and stores the draft', () => {
        const localId = useDraftSignRequestStore
            .getState()
            .createDraft(baseInput())

        expect(localId.startsWith(DRAFT_SIGN_REQUEST_ID_PREFIX)).toBe(true)
        const draft = useDraftSignRequestStore.getState().getDraft(localId)
        expect(draft).toBeDefined()
        expect(draft?.localId).toBe(localId)
        expect(draft?.multisigAddress).toBe('MSIG_ADDRESS')
        expect(draft?.multisigDetails.threshold).toBe(2)
        expect(draft?.multisigDetails.participantAddresses).toEqual([
            'A',
            'B',
            'C',
        ])
        expect(draft?.rawTransactionsBase64).toEqual(['rawTx0base64'])
        expect(draft?.proposeType).toBe('async')
        expect(draft?.createdAt).toBeInstanceOf(Date)
    })

    it('createDraft returns a unique id per call', () => {
        const a = useDraftSignRequestStore.getState().createDraft(baseInput())
        const b = useDraftSignRequestStore.getState().createDraft(baseInput())
        expect(a).not.toBe(b)
        expect(useDraftSignRequestStore.getState().getDraft(a)?.localId).toBe(a)
        expect(useDraftSignRequestStore.getState().getDraft(b)?.localId).toBe(b)
    })

    it('getDraft returns undefined for unknown id', () => {
        expect(
            useDraftSignRequestStore.getState().getDraft('draft-nope'),
        ).toBeUndefined()
    })

    it('deleteDraft removes the draft', () => {
        const localId = useDraftSignRequestStore
            .getState()
            .createDraft(baseInput())
        expect(
            useDraftSignRequestStore.getState().getDraft(localId),
        ).toBeDefined()

        useDraftSignRequestStore.getState().deleteDraft(localId)

        expect(
            useDraftSignRequestStore.getState().getDraft(localId),
        ).toBeUndefined()
    })

    it('deleteDraft is a no-op for unknown id (no state churn)', () => {
        const before = useDraftSignRequestStore.getState().drafts
        useDraftSignRequestStore.getState().deleteDraft('draft-nope')
        expect(useDraftSignRequestStore.getState().drafts).toBe(before)
    })

    it('resetState clears all drafts', () => {
        useDraftSignRequestStore.getState().createDraft(baseInput())
        useDraftSignRequestStore.getState().createDraft(baseInput())
        expect(
            Object.keys(useDraftSignRequestStore.getState().drafts).length,
        ).toBe(2)

        useDraftSignRequestStore.getState().resetState()

        expect(useDraftSignRequestStore.getState().drafts).toEqual({})
    })

    describe('isDraftSignRequestId', () => {
        it('returns true for ids with the draft- prefix', () => {
            expect(isDraftSignRequestId('draft-abc')).toBe(true)
            expect(
                isDraftSignRequestId(
                    `${DRAFT_SIGN_REQUEST_ID_PREFIX}any-suffix`,
                ),
            ).toBe(true)
        })

        it('returns false for real backend ids', () => {
            expect(isDraftSignRequestId('sr-123')).toBe(false)
            expect(isDraftSignRequestId('0188aa45-...')).toBe(false)
            expect(isDraftSignRequestId('')).toBe(false)
        })
    })
})
