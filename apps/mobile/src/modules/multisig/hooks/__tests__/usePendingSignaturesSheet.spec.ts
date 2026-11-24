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
import { renderHook, act } from '@testing-library/react'

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

const { deleteDraftMock } = vi.hoisted(() => ({ deleteDraftMock: vi.fn() }))
vi.mock('@perawallet/wallet-core-multisig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-multisig')
        >()
    return { ...actual, deleteDraftSignRequest: deleteDraftMock }
})

import { usePendingSignaturesSheet } from '../usePendingSignaturesSheet'

describe('usePendingSignaturesSheet', () => {
    beforeEach(() => {
        sheetStateMock.current.signRequestId = null
        openSheetMock.mockClear()
        enqueueSheetMock.mockClear()
        deleteDraftMock.mockClear()
    })

    it('opens the sheet for the given sign request', () => {
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('sr-1'))

        expect(openSheetMock).toHaveBeenCalledWith('sr-1', undefined)
        expect(deleteDraftMock).not.toHaveBeenCalled()
    })

    it('carries the opener chain to the sheet', () => {
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('sr-1', 'ethereum'))

        expect(openSheetMock).toHaveBeenCalledWith('sr-1', 'ethereum')
    })

    it('keeps an open draft rather than replacing it with another sign request', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        let isShown = true
        act(() => {
            isShown = result.current.showSignRequest('sr-real')
        })

        expect(isShown).toBe(false)
        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).not.toHaveBeenCalled()
    })

    it('keeps the current request when a link opens a different real request', () => {
        sheetStateMock.current.signRequestId = 'sr-existing'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        let isShown = true
        act(() => {
            isShown = result.current.showSignRequest('sr-real')
        })

        expect(isShown).toBe(false)
        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).not.toHaveBeenCalled()
    })

    it('accepts the link if the sheet already shows that draft', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        let isShown = false
        act(() => {
            isShown = result.current.showSignRequest('draft-abc')
        })

        expect(isShown).toBe(true)
        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).not.toHaveBeenCalled()
    })

    describe('replaceDraft', () => {
        it('drops the proposed draft and swaps the sheet to its sign request', () => {
            sheetStateMock.current.signRequestId = 'draft-abc'
            const { result } = renderHook(() => usePendingSignaturesSheet())

            act(() =>
                result.current.replaceDraft('draft-abc', 'sr-real', 'algorand'),
            )

            expect(deleteDraftMock).toHaveBeenCalledWith('draft-abc')
            expect(openSheetMock).toHaveBeenCalledWith('sr-real', 'algorand')
        })

        it('keeps a different draft the sheet now shows', () => {
            sheetStateMock.current.signRequestId = 'draft-other'
            const { result } = renderHook(() => usePendingSignaturesSheet())

            act(() => result.current.replaceDraft('draft-abc', 'sr-real'))

            expect(deleteDraftMock).not.toHaveBeenCalledWith('draft-other')
            expect(openSheetMock).not.toHaveBeenCalled()
            expect(enqueueSheetMock).toHaveBeenCalledWith('sr-real', undefined)
        })
    })
})
