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

import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PhotoPermissionDeniedSheet } from '../PhotoPermissionDeniedSheet'

const mockRequestBottomSheet = vi.hoisted(() => vi.fn())

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('PhotoPermissionDeniedSheet', () => {
    beforeEach(() => {
        mockRequestBottomSheet.mockReset()
    })

    it('does not open the bottom sheet while isVisible is false', () => {
        render(
            <PhotoPermissionDeniedSheet
                isVisible={false}
                onClose={vi.fn()}
                onOpenSettings={vi.fn()}
            />,
        )
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('opens the bottom sheet when isVisible turns true', () => {
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={vi.fn()}
                onOpenSettings={vi.fn()}
            />,
        )
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenSettings when the sheet resolves with true', async () => {
        mockRequestBottomSheet.mockResolvedValue(true)
        const onOpenSettings = vi.fn()
        const onClose = vi.fn()
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={onClose}
                onOpenSettings={onOpenSettings}
            />,
        )
        await vi.waitFor(() => {
            expect(onOpenSettings).toHaveBeenCalledTimes(1)
        })
        expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onClose when the sheet resolves with undefined', async () => {
        mockRequestBottomSheet.mockResolvedValue()
        const onOpenSettings = vi.fn()
        const onClose = vi.fn()
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={onClose}
                onOpenSettings={onOpenSettings}
            />,
        )
        await vi.waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1)
        })
        expect(onOpenSettings).not.toHaveBeenCalled()
    })
})
