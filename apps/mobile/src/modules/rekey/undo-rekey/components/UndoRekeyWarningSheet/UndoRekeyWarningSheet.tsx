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

import { useCallback } from 'react'
import { Linking } from 'react-native'
import { Trans } from 'react-i18next'
import { useTheme } from '@rneui/themed'
import Svg, { Circle, Path } from 'react-native-svg'
import { PWBottomSheet, PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

const LEARN_MORE_URL =
    'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/'

export type UndoRekeyWarningSheetProps = {
    isVisible: boolean
    sourceName: string
    currentAuthName: string
    onClose: () => void
    onConfirm: () => void
}

export const UndoRekeyWarningSheet = ({
    isVisible,
    sourceName,
    currentAuthName,
    onClose,
    onConfirm,
}: UndoRekeyWarningSheetProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const handleLearnMore = useCallback(() => {
        Linking.openURL(LEARN_MORE_URL)
    }, [])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            testID='undo-rekey-warning-sheet'
        >
            <PWView style={styles.iconRow}>
                <Svg
                    width={theme.spacing['3xl']}
                    height={theme.spacing['3xl']}
                    viewBox='0 0 24 24'
                    fill='none'
                >
                    <Circle
                        cx='12'
                        cy='12'
                        r='10'
                        stroke={theme.colors.alertNegative}
                        strokeWidth='2'
                    />
                    <Path
                        d='M12 7v6'
                        stroke={theme.colors.alertNegative}
                        strokeWidth='2'
                        strokeLinecap='round'
                    />
                    <Circle
                        cx='12'
                        cy='17'
                        r='1'
                        fill={theme.colors.alertNegative}
                    />
                </Svg>
            </PWView>

            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('rekey.undo.warning.title')}
            </PWText>

            <PWText
                variant='bodyLarge'
                style={styles.message}
            >
                <Trans
                    i18nKey='rekey.undo.warning.body'
                    values={{
                        currentAuth: currentAuthName,
                        source: sourceName,
                    }}
                    components={[
                        <PWText
                            key='auth'
                            variant='h4'
                            style={styles.bold}
                        />,
                        <PWText
                            key='source'
                            variant='h4'
                            style={styles.bold}
                        />,
                        <PWText
                            key='learn-more'
                            variant='h4'
                            style={styles.link}
                            onPress={handleLearnMore}
                        />,
                    ]}
                />
            </PWText>

            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('rekey.undo.warning.confirm')}
                    onPress={onConfirm}
                    testID='undo-rekey-warning-confirm'
                />
                <PWButton
                    variant='secondary'
                    title={t('rekey.undo.warning.cancel')}
                    onPress={onClose}
                    testID='undo-rekey-warning-cancel'
                />
            </PWView>
        </PWBottomSheet>
    )
}
