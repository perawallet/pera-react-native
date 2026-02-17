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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'

import { useStyles } from './styles'

export type WordSuggestionDropdownProps = {
    suggestions: string[]
    onSelectSuggestion: (word: string) => void
}

export const WordSuggestionDropdown = ({
    suggestions,
    onSelectSuggestion,
}: WordSuggestionDropdownProps) => {
    const styles = useStyles()

    if (suggestions.length === 0) {
        return null
    }

    return (
        <PWView style={styles.container}>
            {suggestions.map(word => (
                <PWTouchableOpacity
                    key={word}
                    style={styles.suggestionItem}
                    onPress={() => onSelectSuggestion(word)}
                    testID={`suggestion-${word}`}
                >
                    <PWText
                        variant='body'
                        style={styles.suggestionText}
                    >
                        {word}
                    </PWText>
                </PWTouchableOpacity>
            ))}
        </PWView>
    )
}
