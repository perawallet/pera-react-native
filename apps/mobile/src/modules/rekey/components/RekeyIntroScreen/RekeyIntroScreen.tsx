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

import { useMemo } from 'react'
import heroImage from '@assets/images/rekey-hero.jpg'
import { PWButton, PWImage, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { NumberedList } from '@components/NumberedList'
import {
    useRekeyIntroScreen,
    type RekeyIntroNavConfig,
} from './useRekeyIntroScreen'
import { useStyles } from './styles'
import type { I18nKey } from '@perawallet/wallet-core-chain-contract'

export type RekeyIntroCopy = {
    titleKey: I18nKey
    bodyKey: I18nKey
    learnMoreKey: I18nKey
    expectLabelKey: I18nKey
    ctaKey: I18nKey
    expectationKeys: readonly I18nKey[]
}

export type RekeyIntroScreenProps = {
    copy: RekeyIntroCopy
    testIdPrefix: string
    navConfig: RekeyIntroNavConfig
}

export const RekeyIntroScreen = ({
    copy,
    testIdPrefix,
    navConfig,
}: RekeyIntroScreenProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const expectations = useMemo(
        () => copy.expectationKeys.map(key => t(key)),
        [copy.expectationKeys, t],
    )

    const { handleStartProcess, handleLearnMore } =
        useRekeyIntroScreen(navConfig)

    return (
        <PWScreen
            horizontalPadding='none'
            testID={`${testIdPrefix}-intro-screen`}
            footer={
                <PWButton
                    variant='primary'
                    title={t(copy.ctaKey)}
                    onPress={handleStartProcess}
                    style={styles.cta}
                    testID={`${testIdPrefix}-intro-start`}
                />
            }
        >
            {/* Bundled asset over a placeholder that already matches it: any
                fade or spinner during decode only manufactures a flash. */}
            <PWImage
                source={heroImage}
                style={styles.hero}
                resizeMode='cover'
                transition={false}
                showLoadingIndicator={false}
            />

            <PWView style={styles.body}>
                <PWText variant='h1'>{t(copy.titleKey)}</PWText>

                <PWText
                    variant='bodyLarge'
                    style={styles.bodyText}
                >
                    {t(copy.bodyKey)}{' '}
                    <PWText
                        variant='bodyLarge'
                        style={styles.learnMore}
                        onPress={handleLearnMore}
                    >
                        {t(copy.learnMoreKey)}
                    </PWText>
                </PWText>

                <PWView style={styles.listSection}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.expectLabel}
                    >
                        {t(copy.expectLabelKey)}
                    </PWText>
                    <NumberedList items={expectations} />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
