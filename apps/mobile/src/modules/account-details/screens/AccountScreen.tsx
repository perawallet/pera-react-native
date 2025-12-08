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

import { Tab, TabView } from '@rneui/themed'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import PWIcon from '../../../components/common/icons/PWIcon'

import { useStyles } from './styles'
import { useState } from 'react'
import PWView from '../../../components/common/view/PWView'
import NotificationsIcon from '../../notifications/components/notifications-icon/NotificationsIcon'
import AccountSelection from '../../../components/accounts/account-selection/AccountSelection'
import AccountMenu from '../../../components/account-menu/AccountMenu'
import { Drawer } from 'react-native-drawer-layout'
import QRScannerView from '../../../components/common/qr-scanner/QRScannerView'
import PWTouchableOpacity from '../../../components/common/touchable-opacity/PWTouchableOpacity'
import EmptyView from '../../../components/common/empty-view/EmptyView'
import AccountOverview from '../components/account-overview/AccountOverview'
import AccountNfts from '../components/account-nfts/AccountNfts'
import AccountHistory from '../components/account-history/AccountHistory'
import { TAB_ANIMATION_CONFIG } from '../../../constants/ui'
import { useLanguage } from '../../../hooks/useLanguage'

//TODO hook up all the button panel buttons correctly
//TODO implement more menu
//TODO figure out and implement banners/spot banners
//TODO implement nft and history tabs
//TODO implement account info screen somewhere (see old app top right corner)
//TODO add navigation to asset details screen
//TODO implement rekey information && multisig information
const AccountScreen = () => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const [scannerVisible, setScannerVisible] = useState<boolean>(false)
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
    const [tabIndex, setTabIndex] = useState(0)
    const { t } = useLanguage()

    const closeQRScanner = () => {
        setScannerVisible(false)
    }

    const openQRScanner = () => {
        setScannerVisible(true)
    }

    const toggleAccountSelectorVisible = () => {
        setDrawerOpen(true)
    }

    if (!account) {
        return (
            <EmptyView
                title={t('account_details.main_screen.no_account_title')}
                body={t('account_details.main_screen.no_account_body')}
            />
        )
    }

    return (
        <Drawer
            open={drawerOpen}
            onOpen={() => setDrawerOpen(true)}
            onClose={() => setDrawerOpen(false)}
            drawerType='front'
            swipeEnabled
            drawerStyle={styles.drawer}
            renderDrawerContent={() => (
                <AccountMenu
                    onSelected={() => setDrawerOpen(false)}
                    showInbox
                />
            )}
        >
            <PWView style={styles.iconBar}>
                <PWView style={styles.iconBarSection}>
                    {/* TODO we may want to add support for pending inbox items here too
            (like the current inbox since we're using the same screen real estate) */}
                    <AccountSelection onPress={toggleAccountSelectorVisible} />
                </PWView>
                <PWView style={styles.iconBarSection}>
                    <PWTouchableOpacity onPress={openQRScanner}>
                        <PWIcon name='camera' />
                    </PWTouchableOpacity>
                    <NotificationsIcon />
                </PWView>
            </PWView>
            <Tab
                value={tabIndex}
                onChange={e => setTabIndex(e)}
                containerStyle={styles.tabs}
                indicatorStyle={styles.indicator}
                titleStyle={styles.tabItem}
                dense
            >
                <Tab.Item title={t('account_details.main_screen.overview_tab')} />
                <Tab.Item title={t('account_details.main_screen.nfts_tab')} />
                <Tab.Item title={t('account_details.main_screen.history_tab')} />
            </Tab>
            <TabView
                value={tabIndex}
                onChange={setTabIndex}
                animationType='spring'
                animationConfig={TAB_ANIMATION_CONFIG}
            >
                <TabView.Item style={styles.fullWidth}>
                    <AccountOverview account={account} />
                </TabView.Item>
                <TabView.Item style={styles.fullWidth}>
                    <AccountNfts />
                </TabView.Item>
                <TabView.Item style={styles.fullWidth}>
                    <AccountHistory />
                </TabView.Item>
            </TabView>
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
        </Drawer>
    )
}

export default AccountScreen
