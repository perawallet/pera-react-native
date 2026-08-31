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

export type RekeyIntroScreenProps = {
    i18nBaseKey: string
    /** Defaults to `${i18nBaseKey}.title`. */
    titleKey?: string
    testIdPrefix: string
    expectationCount: 3 | 4
    navConfig: RekeyIntroNavConfig
}

export const RekeyIntroScreen = ({
    i18nBaseKey,
    titleKey = `${i18nBaseKey}.title`,
    testIdPrefix,
    expectationCount,
    navConfig,
}: RekeyIntroScreenProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const expectations = useMemo(
        () =>
            Array.from({ length: expectationCount }, (_, index) =>
                t(`${i18nBaseKey}.expect_${index + 1}`),
            ),
        [expectationCount, i18nBaseKey, t],
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
                    title={t(`${i18nBaseKey}.cta`)}
                    onPress={handleStartProcess}
                    style={styles.cta}
                    testID={`${testIdPrefix}-intro-start`}
                />
            }
        >
            <PWImage
                source={heroImage}
                style={styles.hero}
                resizeMode='cover'
            />

            <PWView style={styles.body}>
                <PWText variant='h1'>{t(titleKey)}</PWText>

                <PWText
                    variant='bodyLarge'
                    style={styles.bodyText}
                >
                    {t(`${i18nBaseKey}.body`)}{' '}
                    <PWText
                        variant='bodyLarge'
                        style={styles.learnMore}
                        onPress={handleLearnMore}
                    >
                        {t(`${i18nBaseKey}.learn_more`)}
                    </PWText>
                </PWText>

                <PWView style={styles.listSection}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.expectLabel}
                    >
                        {t(`${i18nBaseKey}.expect_label`)}
                    </PWText>
                    <NumberedList items={expectations} />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
