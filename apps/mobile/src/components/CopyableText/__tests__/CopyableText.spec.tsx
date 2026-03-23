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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PWText } from '@components/core'
import { CopyableText } from '../CopyableText'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

describe('CopyableText', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders children', () => {
        render(
            <CopyableText copyValue='12345'>
                <PWText testID='child-text'>Asset 12345</PWText>
            </CopyableText>,
        )

        expect(screen.getByTestId('child-text')).toBeTruthy()
        expect(screen.getByText('Asset 12345')).toBeTruthy()
    })

    it('renders with testID for accessibility', () => {
        render(
            <CopyableText
                copyValue='67890'
                testID='copyable'
            >
                <PWText>67890</PWText>
            </CopyableText>,
        )

        expect(screen.getByTestId('copyable')).toBeTruthy()
    })
})
