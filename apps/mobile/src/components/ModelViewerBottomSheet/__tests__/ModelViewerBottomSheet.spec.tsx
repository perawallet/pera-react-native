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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { ModelViewerBottomSheet } from '../ModelViewerBottomSheet'

vi.mock('react-native-webview', () => ({
    WebView: ({ testID }: { testID?: string; [key: string]: unknown }) => (
        <div data-testid={testID}>WebView</div>
    ),
}))

describe('ModelViewerBottomSheet', () => {
    it('renders the WebView when visible with a model URL', () => {
        render(
            <ModelViewerBottomSheet
                isVisible
                onClose={vi.fn()}
                modelUrl='https://example.com/model.glb'
            />,
        )

        expect(screen.getByTestId('model-viewer-webview')).toBeTruthy()
    })

    it('calls onClose when the close button is pressed', () => {
        const onClose = vi.fn()
        render(
            <ModelViewerBottomSheet
                isVisible
                onClose={onClose}
                modelUrl='https://example.com/model.glb'
            />,
        )

        fireEvent.click(screen.getByTestId('model-viewer-close'))

        expect(onClose).toHaveBeenCalled()
    })
})
