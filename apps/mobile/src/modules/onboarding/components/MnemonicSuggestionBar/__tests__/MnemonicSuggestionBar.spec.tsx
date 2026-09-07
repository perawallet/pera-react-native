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

import { Keyboard } from 'react-native'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'

import { MnemonicSuggestionBar } from '../MnemonicSuggestionBar'

describe('MnemonicSuggestionBar', () => {
    it('renders one pill per suggestion', () => {
        render(
            <MnemonicSuggestionBar
                suggestions={['abandon', 'ability', 'able']}
                onSelectSuggestion={vi.fn()}
            />,
        )

        expect(screen.getByText('abandon')).toBeTruthy()
        expect(screen.getByText('ability')).toBeTruthy()
        expect(screen.getByText('able')).toBeTruthy()
    })

    it('renders nothing when there are no suggestions', () => {
        render(
            <MnemonicSuggestionBar
                suggestions={[]}
                onSelectSuggestion={vi.fn()}
                testIDPrefix='test_suggestion'
            />,
        )

        expect(screen.queryByTestId(/^test_suggestion_/)).toBeNull()
    })

    it('invokes onSelectSuggestion with the tapped word', () => {
        const onSelectSuggestion = vi.fn()
        render(
            <MnemonicSuggestionBar
                suggestions={['abandon', 'ability']}
                onSelectSuggestion={onSelectSuggestion}
                testIDPrefix='test_suggestion'
            />,
        )

        fireEvent.click(screen.getByTestId('test_suggestion_ability'))

        expect(onSelectSuggestion).toHaveBeenCalledWith('ability')
    })

    it('leaves the keyboard up when a suggestion is tapped', () => {
        const dismissSpy = vi.spyOn(Keyboard, 'dismiss')
        render(
            <MnemonicSuggestionBar
                suggestions={['abandon']}
                onSelectSuggestion={vi.fn()}
                testIDPrefix='test_suggestion'
            />,
        )

        fireEvent.click(screen.getByTestId('test_suggestion_abandon'))

        expect(dismissSpy).not.toHaveBeenCalled()
    })
})
