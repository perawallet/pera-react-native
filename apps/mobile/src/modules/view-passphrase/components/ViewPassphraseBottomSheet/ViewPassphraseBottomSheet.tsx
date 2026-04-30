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

import { ActivityIndicator } from 'react-native'
import { PWBottomSheet, PWHeader, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { useViewPassphraseBottomSheet } from './useViewPassphraseBottomSheet'
import { useStyles } from './styles'

const SCREEN_CAPTURE_TAG = 'view-passphrase'

export type ViewPassphraseBottomSheetProps = {
    isVisible: boolean
    address: string
    onClose: () => void
    testID?: string
}

export const ViewPassphraseBottomSheet = ({
    isVisible,
    address,
    onClose,
    testID = 'view_passphrase_bottom_sheet',
}: ViewPassphraseBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { words, isLoading, error } = useViewPassphraseBottomSheet({
        address,
        isVisible,
    })

    usePreventScreenCapture(SCREEN_CAPTURE_TAG, isVisible)

    return (
        <PWBottomSheet
            isVisible={isVisible}
            size='lg'
            onBackdropPress={onClose}
            onDismiss={onClose}
            enablePanDownToClose
            innerContainerStyle={styles.container}
            testID={testID}
        >
            <PWHeader
                leftIcon='cross'
                onLeftPress={onClose}
            />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('view_passphrase.screen.title')}
            </PWText>
            <PWText
                variant='body'
                style={styles.description}
            >
                {t('view_passphrase.screen.body')}
            </PWText>

            {isLoading && (
                <PWView style={styles.loading}>
                    <ActivityIndicator />
                </PWView>
            )}

            {!!error && !isLoading && (
                <PWView style={styles.errorBox}>
                    <PWText variant='h4'>
                        {t('view_passphrase.screen.error_title')}
                    </PWText>
                    <PWText style={styles.errorBody}>
                        {t('view_passphrase.screen.error_body')}
                    </PWText>
                </PWView>
            )}

            {!isLoading && !error && words.length > 0 && (
                <PWView
                    style={styles.grid}
                    testID={`${testID}_grid`}
                >
                    {[0, 1].map(columnIndex => {
                        const half = Math.ceil(words.length / 2)
                        const start = columnIndex * half
                        const columnWords = words.slice(start, start + half)
                        return (
                            <PWView
                                key={columnIndex}
                                style={styles.column}
                            >
                                {columnWords.map((word, i) => {
                                    const number = start + i + 1
                                    return (
                                        <PWView
                                            key={`${number}-${word}`}
                                            style={styles.wordCell}
                                        >
                                            <PWText style={styles.wordIndex}>
                                                {String(number)}
                                            </PWText>
                                            <PWText style={styles.wordText}>
                                                {word}
                                            </PWText>
                                        </PWView>
                                    )
                                })}
                            </PWView>
                        )
                    })}
                </PWView>
            )}
        </PWBottomSheet>
    )
}
