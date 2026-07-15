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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { mockDismiss, mockReset } = vi.hoisted(() => ({
    mockDismiss: vi.fn(),
    mockReset: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ dismiss: mockDismiss, resolve: vi.fn() }),
}))

vi.mock('../useBidali', () => ({
    useBidali: () => ({ reset: mockReset }),
}))

import { useBidaliClose } from '../useBidaliClose'

describe('useBidaliClose', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dismisses this sheet and clears the Bidali store', () => {
        const { result } = renderHook(() => useBidaliClose())

        act(() => result.current())

        // Dismiss goes through this sheet's own bottom-sheet context, so the
        // close button always closes the sheet the user is looking at.
        expect(mockDismiss).toHaveBeenCalledTimes(1)
        expect(mockReset).toHaveBeenCalledTimes(1)
    })
})
