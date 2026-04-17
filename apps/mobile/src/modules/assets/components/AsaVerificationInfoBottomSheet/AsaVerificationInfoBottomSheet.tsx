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

import { useCallback } from 'react'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWImage,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'

import verificationBadgeLight from '@assets/images/verification-info-badge.png'
import verificationBadgeDark from '@assets/images/verification-info-badge-dark.png'

export type AsaVerificationInfoBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const AsaVerificationInfoBottomSheet = ({
    isVisible,
    onClose,
}: AsaVerificationInfoBottomSheetProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const heroImage =
        theme.mode === 'dark' ? verificationBadgeDark : verificationBadgeLight

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.asaVerificationUrl })
    }, [pushWebView])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.sheetContainer}
            size='lg'
            enablePanDownToClose
            autoCreateContainer={false}
        >
            <PWView style={styles.container}>
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <PWIcon
                        name='cross'
                        size='md'
                    />
                </PWTouchableOpacity>

                <PWScrollView style={styles.scrollContent}>
                    <PWImage
                        source={heroImage}
                        style={styles.heroImage}
                        resizeMode='cover'
                    />

                    <PWView style={styles.content}>
                        <PWText
                            variant='h2'
                            style={styles.title}
                        >
                            {t('asa_verification_info.title')}
                        </PWText>

                        <PWText style={styles.paragraph}>
                            {t('asa_verification_info.body_1')}
                        </PWText>
                        <PWText style={styles.paragraph}>
                            {t('asa_verification_info.body_2')}
                        </PWText>
                        <PWText style={styles.paragraph}>
                            {t('asa_verification_info.body_3')}
                        </PWText>
                    </PWView>
                </PWScrollView>

                <PWView style={styles.footer}>
                    <PWButton
                        title={t('asa_verification_info.learn_more')}
                        variant='secondary'
                        onPress={handleLearnMore}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
