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

import { PWButton, PWImage, PWOverlay, PWText, PWView } from '@components/core'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { theme } = useTheme()
    const { t } = useLanguage()
    const heroImage =
        theme.mode === 'dark' ? multisigIntroHeroDark : multisigIntroHero

    return (
        <PWOverlay
            isVisible={isVisible}
            onBackdropPress={onDismiss}
            overlayStyle={styles.overlay}
            backdropStyle={styles.backdrop}
        >
            <PWView
                style={styles.container}
                testID='multisig_introduction_dialog'
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

                <PWButton
                    variant='primary'
                    title={t('multisig.introduction.continue')}
                    onPress={onContinue}
                    style={styles.continueButton}
                    testID='multisig_introduction_continue_button'
                />
            </PWView>
        </PWOverlay>
    )
}
