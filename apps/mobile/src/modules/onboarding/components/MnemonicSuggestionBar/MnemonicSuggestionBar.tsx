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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'

import { useStyles } from './styles'

export type MnemonicSuggestionBarProps = {
    suggestions: string[]
    onSelectSuggestion: (word: string) => void
    /** testID prefix; each pill is `${testIDPrefix}_${word}`. */
    testIDPrefix?: string
}

/**
 * Sticky horizontal pill bar with wordlist completions for the focused
 * mnemonic slot. Renders nothing when there are no suggestions, so callers
 * can place it unconditionally between scroll and footer.
 */
export const MnemonicSuggestionBar = ({
    suggestions,
    onSelectSuggestion,
    testIDPrefix = 'mnemonic_suggestion',
}: MnemonicSuggestionBarProps) => {
    const styles = useStyles()

    if (suggestions.length === 0) return null

    return (
        <PWView style={styles.bar}>
            {suggestions.map(word => (
                <PWTouchableOpacity
                    key={word}
                    onPress={() => onSelectSuggestion(word)}
                    // Completing a word must not drop the keyboard: the caret
                    // moves straight to the next slot, and on iOS the resign
                    // would force any IME to commit its marked text over the
                    // word just written.
                    dismissKeyboardOnPress={false}
                    style={styles.pill}
                    testID={`${testIDPrefix}_${word}`}
                >
                    <PWText variant='h4'>{word}</PWText>
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}
