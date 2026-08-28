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

import { Linking } from 'react-native'
import {
    PWIcon,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

import { PanelButton } from '@components/PanelButton'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useIsGiftCardsEnabled } from '@hooks/useIsGiftCardsEnabled'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { BidaliContent } from '@modules/gift-card/components/BidaliContent'
import { BIDALI_SHEET_OPTIONS } from '@modules/gift-card/sheet-options'
import { PasteLinkContent } from '@modules/menu/components/PasteLinkContent'
import { useCallback } from 'react'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, MenuEvent, FundEvent } from '@analytics'
import { routeCapabilities } from '@routes/capabilities'
import { useMenuScreen } from './useMenuScreen'

export const MenuScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { isScannerVisible, openScanner, closeScanner } = useMenuScreen()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const isGiftCardsEnabled = useIsGiftCardsEnabled()
    const { pushWebView } = useWebView()

    const openReceiveFunds = useCallback(() => {
        trackEvent(MenuEvent.Receive)
        void requestBottomSheet({
            contents: <ReceiveFundsContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openBidali = useCallback(() => {
        trackEvent(FundEvent.BidaliSelected)
        void requestBottomSheet({
            contents: <BidaliContent />,
            options: BIDALI_SHEET_OPTIONS,
        })
    }, [requestBottomSheet])

    const openPasteLink = useCallback(() => {
        trackEvent(MenuEvent.PasteLink)
        void requestBottomSheet({
            contents: <PasteLinkContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openHelpCenter = useCallback(() => {
        if (!routeCapabilities.inAppWebView) {
            // react-native-web maps Linking.openURL to window.open (new tab).
            void Linking.openURL(config.supportBaseUrl)
            return
        }
        pushWebView({
            url: config.supportBaseUrl,
            id: 'help-center',
        })
    }, [pushWebView])

    const goToSettings = () => {
        navigation.push('Settings')
    }

    const goToContacts = () => {
        navigation.push('Contacts')
    }

    const goToStaking = () => {
        trackEvent(MenuEvent.Stake)
        navigation.push('Staking')
    }

    return (
        <PWScreen
            scroll='never'
            style={styles.container}
            testID='menu_screen'
        >
            <PWView style={styles.iconBar}>
                <PWView style={styles.iconBarSide} />
                <PWView style={styles.titleContainer}>
                    <PWText
                        variant='h4'
                        style={styles.title}
                        truncate
                    >
                        {t('menu.title')}
                    </PWText>
                </PWView>
                <PWView style={styles.iconBarActions}>
                    {routeCapabilities.qrScanner && (
                        <PWTouchableOpacity
                            onPress={openScanner}
                            testID='menu_button'
                        >
                            <PWIcon
                                name='camera'
                                variant='primary'
                            />
                        </PWTouchableOpacity>
                    )}
                    {routeCapabilities.deepLinkPaste && (
                        <PWTouchableOpacity
                            onPress={openPasteLink}
                            testID='menu_paste_link_button'
                        >
                            <PWIcon
                                name='link'
                                variant='primary'
                            />
                        </PWTouchableOpacity>
                    )}
                    <PWTouchableOpacity
                        onPress={goToSettings}
                        testID='menu_settings_button'
                    >
                        <PWIcon
                            name='gear'
                            variant='primary'
                        />
                    </PWTouchableOpacity>
                </PWView>
            </PWView>

            <PWView style={styles.menuContainer}>
                {routeCapabilities.staking && (
                    <PanelButton
                        title={t('menu.staking')}
                        titleWeight='h3'
                        leftIcon='dot-stack'
                        rightIcon='chevron-right'
                        onPress={goToStaking}
                        testID='menu_staking_button'
                    />
                )}
                {isGiftCardsEnabled && (
                    <PanelButton
                        title={t('menu.buy_gift_card')}
                        titleWeight='h3'
                        leftIcon='gift'
                        rightIcon='chevron-right'
                        onPress={openBidali}
                    />
                )}
                <PanelButton
                    title={t('menu.receive')}
                    titleWeight='h3'
                    leftIcon='inflow'
                    rightIcon='chevron-right'
                    onPress={openReceiveFunds}
                />
                <PanelButton
                    title={t('menu.contacts')}
                    titleWeight='h3'
                    leftIcon='person-menu'
                    rightIcon='chevron-right'
                    onPress={goToContacts}
                    testID='menu_contacts_button'
                />
                <PanelButton
                    title={t('menu.get_help')}
                    titleWeight='h3'
                    leftIcon='feedback'
                    rightIcon='chevron-right'
                    onPress={openHelpCenter}
                />
            </PWView>
            {routeCapabilities.qrScanner && (
                <QRScannerView
                    isVisible={isScannerVisible}
                    onSuccess={closeScanner}
                    onClose={closeScanner}
                    animationType='slide'
                />
            )}
        </PWScreen>
    )
}
