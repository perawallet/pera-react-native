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

import { Linking } from 'react-native'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { STAKING_TERMS_URL } from '../../constants'
import { useStakingDisclaimerSheet } from './useStakingDisclaimerSheet'
import { useStyles } from './styles'

export type StakingDisclaimerSheetProps = {
    isVisible: boolean
    onAccept: () => void
    onClose: () => void
}

const DISCLAIMER_BULLETS = [
    'Pera does not control or assume liability for your use of staking services. We expressly disclaim liability for potential losses related to staking services.',
    'Pera cannot guarantee uninterrupted staking operations. Service interruptions can occur due to updates, network changes, provider actions, or congestion.',
    'Pera cannot ensure staking availability for any specific digital asset. Feasibility depends on blockchain rules and third-party provider terms.',
    'Pera has no control over staking rewards provided by the Algorand blockchain network.',
    'Pera does not provide advice or predictions about digital asset value or suitability. The decision to use staking services is your own.',
    'Pera never takes custody of rewards or assets and has no control over Proof-of-Stake networks where validation rights may be delegated.',
    'Pera does not guarantee you will receive staking rewards or any specific reward rates.',
    'Pera is not responsible for staking provider failures to transfer rewards or losses due to risks such as slashing.',
    'Pera does not guarantee uninterrupted or error-free operation of staking services, nor prevention of disruptions caused by third parties.',
    'Pera is not liable for breaches committed by users in relation to third-party staking agreements.',
]

export const StakingDisclaimerSheet = ({
    isVisible,
    onAccept,
    onClose,
}: StakingDisclaimerSheetProps) => {
    const styles = useStyles()
    const { isScrolledToBottom, handleScroll } = useStakingDisclaimerSheet({
        isVisible,
    })

    const handleTermsPress = () => {
        void Linking.openURL(STAKING_TERMS_URL)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>Terms of Service</PWText>}
            />

            <PWScrollView
                testID='staking-disclaimer-scrollview'
                style={styles.scrollView}
                contentContainerStyle={styles.scrollViewContent}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                <PWText style={styles.emphasizedText}>
                    Pera Wallet gives you access to third-party staking
                    services. When you use these services, you work directly
                    with a provider that stakes your digital assets for
                    transaction validation on the Algorand network.
                </PWText>

                <PWText style={styles.paragraph}>
                    Before staking, conduct thorough research and analysis to
                    ensure alignment with your financial goals and risk
                    tolerance.
                </PWText>

                <PWText style={styles.paragraph}>
                    In order to access staking services, you acknowledge and
                    agree to the following:
                </PWText>

                <PWView style={styles.bulletList}>
                    {DISCLAIMER_BULLETS.map(item => (
                        <PWText
                            key={item}
                            style={styles.bulletText}
                        >
                            {`- ${item}`}
                        </PWText>
                    ))}
                </PWView>

                <PWText style={styles.paragraph}>
                    By choosing to use staking services, you acknowledge these
                    conditions and understand the inherent risks.
                </PWText>

                <PWText style={styles.paragraph}>
                    By proceeding, you agree to these{' '}
                    <PWText
                        style={styles.termsLink}
                        onPress={handleTermsPress}
                    >
                        terms
                    </PWText>
                    .
                </PWText>
            </PWScrollView>

            <PWButton
                variant='primary'
                title='Accept'
                onPress={onAccept}
                isDisabled={!isScrolledToBottom}
            />
        </PWBottomSheet>
    )
}
