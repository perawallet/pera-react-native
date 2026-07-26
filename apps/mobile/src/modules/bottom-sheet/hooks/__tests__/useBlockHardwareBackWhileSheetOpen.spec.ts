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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useBottomSheetStore } from '../../store/bottomSheetStore'
import { useBlockHardwareBackWhileSheetOpen } from '../useBlockHardwareBackWhileSheetOpen'

const { mockAddEventListener, mockRemove } = vi.hoisted(() => ({
    mockAddEventListener: vi.fn(),
    mockRemove: vi.fn(),
}))

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: mockAddEventListener,
    },
}))

const openSheet = (id: string) => {
    act(() => {
        useBottomSheetStore.getState().request({ id, contents: id })
    })
}

describe('useBlockHardwareBackWhileSheetOpen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAddEventListener.mockReturnValue({ remove: mockRemove })
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('does not intercept the back press while no sheet is open', () => {
        renderHook(() => useBlockHardwareBackWhileSheetOpen())

        expect(mockAddEventListener).not.toHaveBeenCalled()
    })

    it('swallows the back press while a sheet is visible', () => {
        renderHook(() => useBlockHardwareBackWhileSheetOpen())

        openSheet('A')

        expect(mockAddEventListener).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function),
        )
        const handler = mockAddEventListener.mock.calls[0]?.[1] as () => boolean
        expect(handler()).toBe(true)
    })

    it('restores the back press once the last sheet closes', () => {
        renderHook(() => useBlockHardwareBackWhileSheetOpen())

        openSheet('A')
        act(() => {
            useBottomSheetStore.getState().dismiss('A')
        })

        expect(mockRemove).toHaveBeenCalled()
    })

    it('keeps the back press blocked while at least one sheet remains open', () => {
        renderHook(() => useBlockHardwareBackWhileSheetOpen())

        openSheet('A')
        openSheet('B')
        act(() => {
            useBottomSheetStore.getState().dismiss('A')
        })

        // A's dismissal must not tear down the block — B is still open.
        expect(mockRemove).not.toHaveBeenCalled()
    })
})
