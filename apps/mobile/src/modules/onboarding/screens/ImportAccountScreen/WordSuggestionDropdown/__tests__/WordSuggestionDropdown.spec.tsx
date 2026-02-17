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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { WordSuggestionDropdown } from '../WordSuggestionDropdown'

describe('WordSuggestionDropdown', () => {
    it('renders nothing when suggestions array is empty', () => {
        const { container } = render(
            <WordSuggestionDropdown
                suggestions={[]}
                onSelectSuggestion={vi.fn()}
            />,
        )

        expect(container.children).toHaveLength(0)
    })

    it('renders all suggestion words', () => {
        render(
            <WordSuggestionDropdown
                suggestions={['abandon', 'ability', 'able']}
                onSelectSuggestion={vi.fn()}
            />,
        )

        expect(screen.getByText('abandon')).toBeTruthy()
        expect(screen.getByText('ability')).toBeTruthy()
        expect(screen.getByText('able')).toBeTruthy()
    })

    it('calls onSelectSuggestion with the correct word when pressed', () => {
        const onSelect = vi.fn()

        render(
            <WordSuggestionDropdown
                suggestions={['abandon', 'ability']}
                onSelectSuggestion={onSelect}
            />,
        )

        fireEvent.click(screen.getByText('ability'))

        expect(onSelect).toHaveBeenCalledWith('ability')
    })

    it('does not call onSelectSuggestion for unrelated words', () => {
        const onSelect = vi.fn()

        render(
            <WordSuggestionDropdown
                suggestions={['abandon', 'ability']}
                onSelectSuggestion={onSelect}
            />,
        )

        fireEvent.click(screen.getByText('abandon'))

        expect(onSelect).toHaveBeenCalledWith('abandon')
        expect(onSelect).not.toHaveBeenCalledWith('ability')
    })
})
