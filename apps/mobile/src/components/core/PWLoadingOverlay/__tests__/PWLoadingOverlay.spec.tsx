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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWLoadingOverlay } from '../PWLoadingOverlay'

describe('PWLoadingOverlay', () => {
    it('renders the title when provided and visible', () => {
        render(<PWLoadingOverlay isVisible={true} title="Processing..." />)
        expect(screen.getByText('Processing...')).toBeTruthy()
    })

    it('renders the activity indicator when visible', () => {
        render(<PWLoadingOverlay isVisible={true} />)
        expect(screen.getByTestId('activity-indicator')).toBeTruthy()
    })

    it('does not render content when not visible', () => {
        render(<PWLoadingOverlay isVisible={false} title="Processing..." />)
        expect(screen.queryByText('Processing...')).toBeNull()
        expect(screen.queryByTestId('activity-indicator')).toBeNull()
    })
})
