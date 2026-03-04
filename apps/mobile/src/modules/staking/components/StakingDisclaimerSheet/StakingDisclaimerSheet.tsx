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
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { Trans } from 'react-i18next'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useStakingDisclaimerSheet } from './useStakingDisclaimerSheet'
import { useStyles } from './styles'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

export type StakingDisclaimerSheetProps = {
    isVisible: boolean
    onAccept: () => void
    onClose: () => void
}

const DISCLAIMER_BULLET_KEYS = [
    'staking.disclaimer.bullet_liability',
    'staking.disclaimer.bullet_interruptions',
    'staking.disclaimer.bullet_availability',
    'staking.disclaimer.bullet_rewards_control',
    'staking.disclaimer.bullet_no_advice',
    'staking.disclaimer.bullet_no_custody',
    'staking.disclaimer.bullet_no_guarantee',
    'staking.disclaimer.bullet_provider_failures',
    'staking.disclaimer.bullet_no_error_free',
    'staking.disclaimer.bullet_user_breaches',
] as const

export const StakingDisclaimerSheet = ({
    isVisible,
    onAccept,
    onClose,
}: StakingDisclaimerSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { isScrolledToBottom, handleScroll } = useStakingDisclaimerSheet({
        isVisible,
    })

    const handleTermsPress = () => {
        onClose()
        pushWebView({
            url: config.termsOfServiceUrl,
        })
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            size='lg'
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={onClose}
                    />
                }
                center={
                    <PWText variant='h4'>
                        {t('staking.disclaimer.title')}
                    </PWText>
                }
                paddingStyle='dense'
            />

            <BottomSheetScrollView
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollViewContent}
            >
                <PWText style={styles.emphasizedText}>
                    {t('staking.disclaimer.intro')}
                </PWText>

                <PWText style={styles.paragraph}>
                    {t('staking.disclaimer.research_warning')}
                </PWText>

                <PWText style={styles.paragraph}>
                    {t('staking.disclaimer.acknowledgment_prompt')}
                </PWText>

                <PWView style={styles.bulletList}>
                    {DISCLAIMER_BULLET_KEYS.map(key => (
                        <PWText
                            key={key}
                            style={styles.bulletText}
                        >
                            {`- ${t(key)}`}
                        </PWText>
                    ))}
                </PWView>

                <PWText style={styles.paragraph}>
                    {t('staking.disclaimer.closing')}
                </PWText>

                <PWText style={styles.paragraph}>
                    <Trans
                        i18nKey='staking.disclaimer.terms_agreement'
                        components={[
                            <PWText
                                key='terms'
                                variant='link'
                                onPress={handleTermsPress}
                            />,
                        ]}
                    />
                </PWText>

                <PWButton
                    variant='primary'
                    title={t('staking.disclaimer.accept')}
                    onPress={onAccept}
                    isDisabled={!isScrolledToBottom}
                    style={styles.acceptButton}
                />
            </BottomSheetScrollView>
        </PWBottomSheet>
    )
}
