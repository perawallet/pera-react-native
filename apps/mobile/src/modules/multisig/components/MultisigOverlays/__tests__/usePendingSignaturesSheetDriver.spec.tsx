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

const { requestBottomSheetMock, appLockState } = vi.hoisted(() => ({
    requestBottomSheetMock: vi.fn(() => new Promise(() => {})),
    appLockState: { current: false },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheetMock,
        dismiss: vi.fn(),
        requestByType: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    useSecurityStore: (
        selector: (state: { isAppLockActive: boolean }) => boolean,
    ) => selector({ isAppLockActive: appLockState.current }),
}))

vi.mock('../../PendingSignaturesContent', () => ({
    PendingSignaturesContent: () => null,
}))

describe('usePendingSignaturesSheetDriver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        appLockState.current = false
        usePendingSignaturesSheetStore.getState().resetState()
    })

    it('opens the sheet when a sign request id is set', () => {
        usePendingSignaturesSheetStore.getState().openSheet('sr-1')

        renderHook(() => usePendingSignaturesSheetDriver())

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })

    // PERA-4743 parity: a sheet presented while AutoLockGuard's overlay covers
    // the app surfaces the instant the PIN is accepted ("entered my PIN, then
    // the TX appeared") — reachable from an untrusted push, on the money path.
    it('holds the sheet while the app is locked', () => {
        appLockState.current = true
        usePendingSignaturesSheetStore.getState().openSheet('sr-1')

        renderHook(() => usePendingSignaturesSheetDriver())

        expect(requestBottomSheetMock).not.toHaveBeenCalled()
    })

    it('presents the held sheet once the app unlocks', () => {
        appLockState.current = true
        usePendingSignaturesSheetStore.getState().openSheet('sr-1')

        const { rerender } = renderHook(() => usePendingSignaturesSheetDriver())
        expect(requestBottomSheetMock).not.toHaveBeenCalled()

        appLockState.current = false
        rerender()

        expect(requestBottomSheetMock).toHaveBeenCalledTimes(1)
    })
})
