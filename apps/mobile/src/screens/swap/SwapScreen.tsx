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
import PWView from '../../components/common/view/PWView'
import MainScreenLayout from '../../layouts/MainScreenLayout'
import { useStyles } from './styles'
import PWIcon from '../../components/common/icons/PWIcon'
import PairSelectionPanel from '../../components/swaps/pair-selection-panel/PairSelectionPanel'
import SwapHistoryPanel from '../../components/swaps/swap-history-panel/SwapHistoryPanel'
import TopPairsPanel from '../../components/swaps/top-pairs-panel/TopPairsPanel'
import AccountSelection from '../../components/accounts/account-selection/AccountSelection'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Drawer } from 'react-native-drawer-layout'
import { useState } from 'react'
import AccountMenu from '../../components/account-menu/AccountMenu'

const SwapScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false)

    return (
        <MainScreenLayout
            fullScreen
            style={styles.container}
        >
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
                            Swap
                        </Text>
                        <PWIcon
                            name='info'
                            style={styles.titleIcon}
                        />
                    </PWView>
                    <AccountSelection onPress={() => setDrawerOpen(true)} />
                </PWView>
                <PairSelectionPanel />
                <SwapHistoryPanel />
                <TopPairsPanel />
            </Drawer>
        </MainScreenLayout>
    )
}

export default SwapScreen
