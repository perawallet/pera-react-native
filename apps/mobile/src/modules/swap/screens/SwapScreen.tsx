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

import { Text } from '@rneui/themed'
import PWView from '@components/PWView'
import { useStyles } from './styles'
import PWIcon from '@components/PWIcon'
import PairSelectionPanel from '../components/pair-selection-panel/PairSelectionPanel'
import SwapHistoryPanel from '../components/swap-history-panel/SwapHistoryPanel'
import TopPairsPanel from '../components/top-pairs-panel/TopPairsPanel'
import AccountSelection from '@modules/accounts/components/account-selection/AccountSelection'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Drawer } from 'react-native-drawer-layout'
import { useState } from 'react'
import AccountMenu from '@modules/accounts/components/account-menu/AccountMenu'
import { useLanguage } from '@hooks/language'
import { useWebView } from '@hooks/webview'
import { config } from '@perawallet/wallet-core-config'

const SwapScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const openSwapSupport = () => {
        pushWebView({
            url: config.swapSupportUrl,
            id: 'swap-support',
        })
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
                <AccountMenu onSelected={() => setDrawerOpen(false)} />
            )}
        >
            <PWView style={styles.headerContainer}>
                <PWView style={styles.titleContainer}>
                    <Text
                        h3
                        h3Style={styles.titleText}
                    >
                        {t('tabbar.swap')}
                    </Text>
                    <PWIcon
                        name='info'
                        style={styles.titleIcon}
                        onPress={openSwapSupport}
                    />
                </PWView>
                <AccountSelection onPress={() => setDrawerOpen(true)} />
            </PWView>
            <PairSelectionPanel />
            <SwapHistoryPanel />
            <TopPairsPanel />
        </Drawer>
    )
}

export default SwapScreen
