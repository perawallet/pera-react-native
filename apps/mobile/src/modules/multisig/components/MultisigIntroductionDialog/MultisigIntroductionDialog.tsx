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

import {
    PWButton,
    PWDialog,
    PWImage,
    PWText,
    PWView,
} from '@components/core'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

import multisigIntroHero from '@assets/images/multisig-intro-hero.png'
import multisigIntroHeroDark from '@assets/images/multisig-intro-hero-dark.png'

type MultisigIntroductionDialogProps = {
    isVisible: boolean
    onContinue: () => void
    onDismiss: () => void
}

const BULLET_KEYS = [
    'multisig.introduction.bullet_1',
    'multisig.introduction.bullet_2',
    'multisig.introduction.bullet_3',
] as const

export const MultisigIntroductionDialog = ({
    isVisible,
    onContinue,
    onDismiss,
}: MultisigIntroductionDialogProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const heroImage =
        theme.mode === 'dark' ? multisigIntroHeroDark : multisigIntroHero

    return (
        <PWDialog
            isVisible={isVisible}
            onBackdropPress={onDismiss}
            testID='multisig_introduction_dialog'
            footer={
                <PWButton
                    variant='primary'
                    title={t('multisig.introduction.continue')}
                    onPress={onContinue}
                    style={styles.continueButton}
                    testID='multisig_introduction_continue_button'
                />
            }
        >
            <PWImage
                source={heroImage}
                style={styles.headerImage}
                resizeMode='contain'
            />

            <PWView style={styles.titleContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                    numberOfLines={2}
                    ellipsizeMode='tail'
                >
                    {t('multisig.introduction.title')}
                </PWText>
            </PWView>

            <PWView style={styles.bulletContainer}>
                {BULLET_KEYS.map((key, index) => (
                    <PWView
                        key={key}
                        style={styles.bulletItem}
                        testID={`multisig_introduction_bullet_${index + 1}`}
                    >
                        <PWView style={styles.numberBadge}>
                            <PWText
                                variant='body'
                                style={styles.numberText}
                            >
                                {index + 1}
                            </PWText>
                        </PWView>

                        <PWText
                            variant='body'
                            style={styles.bulletText}
                        >
                            {t(key)}
                        </PWText>
                    </PWView>
                ))}
            </PWView>
        </PWDialog>
    )
}
