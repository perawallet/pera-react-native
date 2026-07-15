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
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type BackupQuizItemProps = {
    position: number
    options: string[]
    selectedWord: string | null
    onSelect: (word: string) => void
    testID?: string
}

export const BackupQuizItem = ({
    position,
    options,
    selectedWord,
    onSelect,
    testID,
}: BackupQuizItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWText style={styles.label}>
                {t('backup.verification.select_word', {
                    number: position + 1,
                })}
            </PWText>
            <PWView style={styles.optionGroup}>
                {options.map(word => {
                    const isSelected = word === selectedWord
                    return (
                        <PWTouchableOpacity
                            key={word}
                            style={[
                                styles.option,
                                isSelected && styles.optionSelected,
                            ]}
                            onPress={() => onSelect(word)}
                            testID={`${testID}_option_${word}`}
                        >
                            <PWText
                                style={[
                                    styles.optionText,
                                    isSelected && styles.optionTextSelected,
                                ]}
                            >
                                {word}
                            </PWText>
                        </PWTouchableOpacity>
                    )
                })}
            </PWView>
        </PWView>
    )
}
