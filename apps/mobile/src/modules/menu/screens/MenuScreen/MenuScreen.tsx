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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

import { PanelButton } from '@components/PanelButton'
import { CardPanel } from '@modules/menu/components/CardPanel/CardPanel'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { QRScannerView } from '@components/QRScannerView'
import { useModalState } from '@hooks/useModalState'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { BidaliContent } from '@modules/gift-card/components/BidaliContent'
import { useCallback } from 'react'

export const MenuScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const scanner = useModalState()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()

    const openReceiveFunds = useCallback(() => {
        void requestBottomSheet({
            contents: <ReceiveFundsContent />,
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openBidali = useCallback(() => {
        void requestBottomSheet({
            contents: <BidaliContent />,
            options: {
                size: 'lg',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const goToSettings = () => {
        navigation.push('Settings')
    }

    const goToContacts = () => {
        navigation.push('Contacts')
    }

    const goToStaking = () => {
        navigation.push('Staking')
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconBar}>
                <PWView style={styles.iconBarColumn} />
                <PWText
                    variant='h4'
                    style={styles.iconBarColumn}
                >
                    {t('menu.title')}
                </PWText>
                <PWView style={styles.iconBarColumn}>
                    <PWTouchableOpacity
                        onPress={scanner.open}
                        testID='menu_button'
                    >
                        <PWIcon
                            name='camera'
                            variant='primary'
                        />
                    </PWTouchableOpacity>
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
                <CardPanel />
                <PanelButton
                    title={t('menu.staking')}
                    titleWeight='h3'
                    leftIcon='dot-stack'
                    rightIcon='chevron-right'
                    onPress={goToStaking}
                    testID='menu_staking_button'
                />
                <PanelButton
                    title={t('menu.buy_gift_card')}
                    titleWeight='h3'
                    leftIcon='gift'
                    rightIcon='chevron-right'
                    onPress={openBidali}
                />
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
                />
            </PWView>
            <QRScannerView
                isVisible={scanner.isOpen}
                onSuccess={scanner.close}
                onClose={scanner.close}
                animationType='slide'
            />
        </PWView>
    )
}
