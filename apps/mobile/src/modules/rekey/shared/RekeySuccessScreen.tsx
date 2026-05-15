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

import { Trans } from 'react-i18next'
import { useTheme } from '@rneui/themed'
import CheckIcon from '@assets/icons/check.svg'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSafeAreaPadding } from '@hooks/useBottomSafeAreaPadding'
import { useRekeySuccessScreen } from './useRekeySuccessScreen'
import { useRekeySuccessStyles } from './useRekeySuccessStyles'

export type RekeySuccessScreenProps = {
    i18nPrefix: string
    testIdPrefix: string
}

export const RekeySuccessScreen = ({
    i18nPrefix,
    testIdPrefix,
}: RekeySuccessScreenProps) => {
    const bottomPadding = useBottomSafeAreaPadding()
    const styles = useRekeySuccessStyles(bottomPadding)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { sourceName, handleDone } = useRekeySuccessScreen()

    const checkSize = theme.spacing['5xl'] * 2

    return (
        <PWView
            style={styles.container}
            testID={`${testIdPrefix}-success-screen`}
        >
            <PWView style={styles.content}>
                <PWView style={styles.iconWrapper}>
                    <CheckIcon
                        width={checkSize}
                        height={checkSize}
                        color={theme.colors.textMain}
                    />
                </PWView>

                <PWView style={styles.textBlock}>
                    <PWText
                        variant='h1'
                        style={styles.title}
                    >
                        {t(`${i18nPrefix}.title`)}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.body}
                    >
                        <Trans
                            i18nKey={`${i18nPrefix}.body`}
                            values={{ source: sourceName }}
                            components={[
                                <PWText
                                    key='source'
                                    variant='h4'
                                    style={styles.body}
                                />,
                            ]}
                        />
                    </PWText>
                </PWView>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    variant='primary'
                    title={t(`${i18nPrefix}.cta`)}
                    onPress={handleDone}
                    style={styles.cta}
                    testID={`${testIdPrefix}-success-done`}
                />
            </PWView>
        </PWView>
    )
}
