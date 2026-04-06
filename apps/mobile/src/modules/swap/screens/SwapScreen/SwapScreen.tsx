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
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { config } from '@perawallet/wallet-core-config'
import { PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { useWebView } from '@modules/webview'
import { useSwapIntroduction } from '@modules/swap/hooks'
import { SwapForm, SwapIntroduction } from '@modules/swap/components'
import { useStyles } from './styles'
import { useSwapScreen } from './useSwapScreen'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { pushWebView } = useWebView()
    const { isIntroductionSeen, markIntroductionSeen } = useSwapIntroduction()
    const introModal = useModalState(!isIntroductionSeen)
    useSwapScreen()

    const handleStartSwapping = useCallback(() => {
        markIntroductionSeen()
        introModal.close()
    }, [markIntroductionSeen, introModal])

    const handleInfoPress = useCallback(() => {
        pushWebView({ url: config.swapSupportUrl })
    }, [pushWebView])

    return (
        <PWView style={styles.container}>
            <PWToolbar
                left={
                    <PWView style={styles.titleSection}>
                        <PWText variant='h3'>{t('tabbar.swap')}</PWText>
                        <PWIcon
                            name='info'
                            onPress={handleInfoPress}
                        />
                    </PWView>
                }
                right={
                    <AccountSelection
                        headerContent={
                            <PWView style={styles.selectHeader}>
                                <PWText variant='h2'>
                                    {t('account_menu.select_title')}
                                </PWText>
                                <PWText style={styles.selectDescription}>
                                    {t('account_menu.select_description')}
                                </PWText>
                            </PWView>
                        }
                    />
                }
                style={styles.toolbar}
            />

            <SwapForm />

            <SwapIntroduction
                isVisible={introModal.isOpen}
                onStartSwapping={handleStartSwapping}
                onClose={introModal.close}
            />
        </PWView>
    )
}
