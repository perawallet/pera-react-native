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

import { PWButton, PWSheetLayout, PWText, PWView } from '@components/core'
import { Trans } from 'react-i18next'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useStakingDisclaimerSheet } from './useStakingDisclaimerContent'
import { useStyles } from './styles'

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

export const StakingDisclaimerContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const { resolve, dismiss } = useBottomSheetResult<boolean>()
    const {
        isScrolledToBottom,
        handleScroll,
        handleLayout,
        handleContentSizeChange,
    } = useStakingDisclaimerSheet()

    const handleTermsPress = () => {
        dismiss()
        pushWebView({
            url: config.termsOfServiceUrl,
        })
    }

    return (
        <PWSheetLayout
            onScroll={handleScroll}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
            testID='staking-disclaimer-content'
            header={
                <SheetHeader
                    title={t('staking.disclaimer.title')}
                    testID='staking-disclaimer'
                />
            }
        >
            <PWView style={styles.scrollViewContent}>
                <PWText
                    variant='bodyCompact'
                    style={styles.emphasizedText}
                >
                    {t('staking.disclaimer.intro')}
                </PWText>

                <PWText
                    variant='bodyCompact'
                    style={styles.paragraph}
                >
                    {t('staking.disclaimer.research_warning')}
                </PWText>

                <PWText
                    variant='bodyCompact'
                    style={styles.paragraph}
                >
                    {t('staking.disclaimer.acknowledgment_prompt')}
                </PWText>

                <PWView style={styles.bulletList}>
                    {DISCLAIMER_BULLET_KEYS.map(key => (
                        <PWText
                            key={key}
                            variant='bodyCompact'
                            style={styles.bulletText}
                        >
                            {`- ${t(key)}`}
                        </PWText>
                    ))}
                </PWView>

                <PWText
                    variant='bodyCompact'
                    style={styles.paragraph}
                >
                    {t('staking.disclaimer.closing')}
                </PWText>

                <PWText
                    variant='bodyCompact'
                    style={styles.paragraph}
                >
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
                    onPress={() => resolve(true)}
                    isDisabled={!isScrolledToBottom}
                    style={styles.acceptButton}
                    testID='staking-disclaimer-accept-button'
                />
            </PWView>
        </PWSheetLayout>
    )
}
