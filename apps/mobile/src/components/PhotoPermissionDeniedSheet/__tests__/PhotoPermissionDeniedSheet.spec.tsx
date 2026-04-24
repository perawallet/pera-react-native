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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PhotoPermissionDeniedSheet } from '../PhotoPermissionDeniedSheet'

describe('PhotoPermissionDeniedSheet', () => {
    it('renders the permission copy when visible', () => {
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={vi.fn()}
                onOpenSettings={vi.fn()}
            />,
        )
        expect(screen.getByText('image_picker.permission_title')).toBeTruthy()
        expect(
            screen.getByText('image_picker.open_settings.label'),
        ).toBeTruthy()
    })

    it('invokes onOpenSettings when the confirm button is pressed', () => {
        const onOpenSettings = vi.fn()
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={vi.fn()}
                onOpenSettings={onOpenSettings}
            />,
        )
        fireEvent.click(screen.getByText('image_picker.open_settings.label'))
        expect(onOpenSettings).toHaveBeenCalledTimes(1)
    })

    it('invokes onClose when the cancel button is pressed', () => {
        const onClose = vi.fn()
        render(
            <PhotoPermissionDeniedSheet
                isVisible
                onClose={onClose}
                onOpenSettings={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('common.cancel.label'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
