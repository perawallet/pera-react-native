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

import { Trans } from 'react-i18next'
import { useTheme } from '@rneui/themed'
import type { I18nKey } from '@perawallet/wallet-core-chain-contract'
import CheckIcon from '@assets/icons/check.svg'
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useRekeySuccessScreen } from './useRekeySuccessScreen'
import { useStyles } from './styles'

export type RekeySuccessCopy = {
    titleKey: I18nKey
    bodyKey: I18nKey
    ctaKey: I18nKey
}

export type RekeySuccessScreenProps = {
    copy: RekeySuccessCopy
    testIdPrefix: string
}

export const RekeySuccessScreen = ({
    copy,
    testIdPrefix,
}: RekeySuccessScreenProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { sourceName, handleDone } = useRekeySuccessScreen()

    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: check artwork size (192)
    const checkSize = theme.spacing['5xl'] * 2

    return (
        <PWScreen
            scroll='never'
            testID={`${testIdPrefix}-success-screen`}
            footer={
                <PWButton
                    variant='primary'
                    title={t(copy.ctaKey)}
                    onPress={handleDone}
                    style={styles.cta}
                    testID={`${testIdPrefix}-success-done`}
                />
            }
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
                        {t(copy.titleKey)}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.body}
                    >
                        <Trans
                            i18nKey={copy.bodyKey}
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
        </PWScreen>
    )
}
