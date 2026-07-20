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

import { useCallback, useEffect, useRef } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { config } from '@perawallet/wallet-core-config'
import { PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import {
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { useWebView } from '@modules/webview'
import { useSwapIntroduction } from '@modules/swap/hooks'
import { SwapForm, SwapIntroductionContent } from '@modules/swap/components'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useSwapScreen } from './useSwapScreen'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const accounts = useAllAccounts()
    const swapAccountFilter = useCallback(
        (account: WalletAccount) => canSignWith(account, accounts),
        [accounts],
    )
    const { pushWebView } = useWebView()
    const { isIntroductionSeen, markIntroductionSeen } = useSwapIntroduction()
    const { request: requestBottomSheet } = useBottomSheet()
    useSwapScreen()

    const hasShownIntroRef = useRef(false)
    useEffect(() => {
        if (isIntroductionSeen || hasShownIntroRef.current) return
        hasShownIntroRef.current = true
        void requestBottomSheet<'start'>({
            contents: <SwapIntroductionContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        }).then(result => {
            if (result === 'start') {
                markIntroductionSeen()
            }
        })
    }, [isIntroductionSeen, requestBottomSheet, markIntroductionSeen])

    const handleInfoPress = useCallback(() => {
        pushWebView({ url: config.swapSupportUrl })
    }, [pushWebView])

    return (
        <PWView style={styles.screen}>
            <PWToolbar
                paddingStyle='none'
                left={
                    <PWView style={styles.titleSection}>
                        <PWText
                            variant='h3'
                            truncate
                        >
                            {t('tabbar.swap')}
                        </PWText>
                        <PWIcon
                            name='info'
                            onPress={handleInfoPress}
                            testID='swap_info_button'
                        />
                    </PWView>
                }
                right={
                    <AccountSelection
                        accountFilter={swapAccountFilter}
                        triggerStyle={styles.accountTrigger}
                        triggerIconProps={{ size: 'md' }}
                        triggerChevronProps={{ size: 'sm' }}
                        triggerTextProps={{ variant: 'body' }}
                        hideDefaultHeader
                        headerContent={
                            <PWView style={styles.selectHeader}>
                                <PWText
                                    variant='h1'
                                    style={styles.selectTitle}
                                    truncate
                                >
                                    {t('account_menu.select_title')}
                                </PWText>
                                <PWText
                                    style={styles.selectDescription}
                                    numberOfLines={2}
                                    ellipsizeMode='tail'
                                >
                                    {t('account_menu.select_description')}
                                </PWText>
                            </PWView>
                        }
                    />
                }
                style={styles.toolbar}
            />

            <PWView style={styles.formWrapper}>
                <SwapForm />
            </PWView>
        </PWView>
    )
}
