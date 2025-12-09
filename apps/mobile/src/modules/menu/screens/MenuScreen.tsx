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

import PWView from '../../../components/common/view/PWView'
import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import PWIcon from '../../../components/common/icons/PWIcon'

import PanelButton from '../../../components/common/panel-button/PanelButton'
import CardPanel from '../components/card-panel/CardPanel'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import PWTouchableOpacity from '../../../components/common/touchable-opacity/PWTouchableOpacity'
import QRScannerView from '../../../components/common/qr-scanner/QRScannerView'
import { useState } from 'react'
import { useLanguage } from '../../../hooks/useLanguage'

const MenuScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const [scannerVisible, setScannerVisible] = useState<boolean>(false)
    const { t } = useLanguage()

    const goToSettings = () => {
        navigation.push('Settings')
    }

    const goToContacts = () => {
        navigation.push('Contacts')
    }

    const goToStaking = () => {
        navigation.push('Staking')
    }

    const closeQRScanner = () => {
        setScannerVisible(false)
    }

    const openQRScanner = () => {
        setScannerVisible(true)
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconBar}>
                <PWView style={styles.iconBarColumn} />
                <Text
                    h4
                    style={styles.iconBarColumn}
                >
                    {t('menu.title')}
                </Text>
                <PWView style={styles.iconBarColumn}>
                    <PWTouchableOpacity onPress={openQRScanner}>
                        <PWIcon
                            name='camera'
                            variant='primary'
                        />
                    </PWTouchableOpacity>
                    <PWTouchableOpacity onPress={goToSettings}>
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
                />
                <PanelButton
                    title={t('menu.nfts')}
                    titleWeight='h3'
                    leftIcon='card-stack'
                    rightIcon='chevron-right'
                    onPress={() => { }}
                />
                <PanelButton
                    title={t('menu.buy_gift_card')}
                    titleWeight='h3'
                    leftIcon='gift'
                    rightIcon='chevron-right'
                    onPress={() => { }}
                />
                <PanelButton
                    title={t('menu.receive')}
                    titleWeight='h3'
                    leftIcon='inflow'
                    rightIcon='chevron-right'
                    onPress={() => { }}
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
                visible={scannerVisible}
                onSuccess={closeQRScanner}
                animationType='slide'
            >
                <PWTouchableOpacity
                    onPress={closeQRScanner}
                    style={styles.scannerClose}
                >
                    <PWIcon
                        name='cross'
                        variant='white'
                    />
                </PWTouchableOpacity>
            </QRScannerView>
        </PWView>
    )
}

export default MenuScreen
