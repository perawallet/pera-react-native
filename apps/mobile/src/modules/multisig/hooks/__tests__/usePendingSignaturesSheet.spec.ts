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
import { renderHook, act } from '@testing-library/react'

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

const { deleteDraftMock } = vi.hoisted(() => ({ deleteDraftMock: vi.fn() }))
vi.mock('@perawallet/wallet-core-multisig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-multisig')
        >()
    const stub = (() => ({ deleteDraft: deleteDraftMock })) as unknown as {
        getState: () => { deleteDraft: typeof deleteDraftMock }
    }
    stub.getState = () => ({ deleteDraft: deleteDraftMock })
    return { ...actual, useDraftSignRequestStore: stub }
})

import { usePendingSignaturesSheet } from '../usePendingSignaturesSheet'

describe('usePendingSignaturesSheet', () => {
    beforeEach(() => {
        sheetStateMock.current.signRequestId = null
        openSheetMock.mockClear()
        deleteDraftMock.mockClear()
    })

    it('opens the sheet for the given sign request', () => {
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('sr-1'))

        expect(openSheetMock).toHaveBeenCalledWith('sr-1')
        expect(deleteDraftMock).not.toHaveBeenCalled()
    })

    it('drops the superseded draft and swaps to the real id when the open sheet shows a draft', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('sr-real'))

        expect(deleteDraftMock).toHaveBeenCalledTimes(1)
        expect(deleteDraftMock).toHaveBeenCalledWith('draft-abc')
        expect(openSheetMock).toHaveBeenCalledWith('sr-real')
    })

    it('does not delete a draft when the open sheet id is already real', () => {
        sheetStateMock.current.signRequestId = 'sr-existing'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('sr-real'))

        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).toHaveBeenCalledWith('sr-real')
    })

    it('does not delete the draft when the incoming id is also a draft', () => {
        sheetStateMock.current.signRequestId = 'draft-abc'
        const { result } = renderHook(() => usePendingSignaturesSheet())

        act(() => result.current.showSignRequest('draft-abc'))

        expect(deleteDraftMock).not.toHaveBeenCalled()
        expect(openSheetMock).toHaveBeenCalledWith('draft-abc')
    })
})
