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
import { usePendingSignaturesSheetStore } from '../../../stores/usePendingSignaturesSheetStore'
import { usePendingSignaturesSheetDriver } from '../usePendingSignaturesSheetDriver'

const { requestBottomSheetMock } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn(() => new Promise(() => {})),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: vi.fn(),
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('../../PendingSignaturesContent', () => ({
    PendingSignaturesContent: () => null,
}))

// App-lock behavior is NOT tested here on purpose: the hold lives in
// BottomSheetManager's usePresentableRequests, centralized there, so
// this driver requests unconditionally.
describe('usePendingSignaturesSheetDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        usePendingSignaturesSheetStore.getState().resetState()
    })

    it('opens the sheet when a sign request id is set', () => {
        usePendingSignaturesSheetStore.getState().openSheet('sr-1')

        renderHook(() => usePendingSignaturesSheetDriver())

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })
})
