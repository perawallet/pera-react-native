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
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import {
    AccountDrawerPager,
    useAccountDrawerPickerKind,
    useSigningPicker,
} from '@modules/accounts/components/AccountDrawer'
import { useWebView } from '@modules/webview'
import { useSwapIntroduction } from '@modules/swap/hooks'
import { SwapForm, SwapIntroductionContent } from '@modules/swap/components'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useSwapScreen } from './useSwapScreen'

export const SwapScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
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

    // One definition behind the drawer and the bottom-sheet fallback alike.
    const accountPicker = useSigningPicker()
    useAccountDrawerPickerKind('select')

    return (
        // One page, so nothing to page between — the pager is here purely
        // because its pan is what opens the shared drawer, from anywhere on the
        // screen rather than from a strip at the edge.
        <AccountDrawerPager>
            <PWView
                key='swap'
                style={styles.screen}
            >
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
                            {...accountPicker}
                            triggerStyle={styles.accountTrigger}
                            triggerIconProps={{ size: 'sm' }}
                            triggerChevronProps={{ size: 'sm' }}
                            triggerTextProps={{ variant: 'body' }}
                        />
                    }
                    style={styles.toolbar}
                />

                <PWView style={styles.formWrapper}>
                    <SwapForm />
                </PWView>
            </PWView>
        </AccountDrawerPager>
    )
}
