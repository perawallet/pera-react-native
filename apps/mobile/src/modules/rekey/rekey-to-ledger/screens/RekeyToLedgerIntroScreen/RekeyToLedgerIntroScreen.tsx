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

import { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import heroImage from '@assets/images/rekey-to-ledger-hero.jpg'
import {
    PWButton,
    PWImage,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { NumberedList } from '@modules/rekey/rekey-to-standard/components/NumberedList'
import { useRekeyToLedgerIntroScreen } from './useRekeyToLedgerIntroScreen'
import { useStyles } from './styles'

export const RekeyToLedgerIntroScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()

    const expectations = useMemo(
        () => [
            t('rekey.to_ledger.intro.expect_1'),
            t('rekey.to_ledger.intro.expect_2'),
            t('rekey.to_ledger.intro.expect_3'),
            t('rekey.to_ledger.intro.expect_4'),
        ],
        [t],
    )

    const { handleStartProcess, handleLearnMore } =
        useRekeyToLedgerIntroScreen()

    return (
        <PWView
            style={styles.root}
            testID='rekey-to-ledger-intro-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWImage
                    source={heroImage}
                    style={styles.hero}
                    resizeMode='cover'
                />

                <PWView style={styles.body}>
                    <PWText variant='h1'>
                        {t('rekey.to_ledger.intro.title')}
                    </PWText>

                    <PWText
                        variant='bodyLarge'
                        style={styles.bodyText}
                    >
                        {t('rekey.to_ledger.intro.body')}{' '}
                        <PWText
                            variant='bodyLarge'
                            style={styles.learnMore}
                            onPress={handleLearnMore}
                        >
                            {t('rekey.to_ledger.intro.learn_more')}
                        </PWText>
                    </PWText>

                    <PWView style={styles.listSection}>
                        <PWText
                            variant='bodySemibold'
                            style={styles.expectLabel}
                        >
                            {t('rekey.to_ledger.intro.expect_label')}
                        </PWText>
                        <NumberedList items={expectations} />
                    </PWView>
                </PWView>
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWButton
                    variant='primary'
                    title={t('rekey.to_ledger.intro.cta')}
                    onPress={handleStartProcess}
                    style={styles.cta}
                    testID='rekey-to-ledger-intro-start'
                />
            </PWView>
        </PWView>
    )
}
