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

import {
    PWIcon,
    PWTab,
    PWTabView,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useShouldPlayConfetti } from '@modules/onboarding/hooks'

import { useStyles } from './styles'
import { useState, useEffect } from 'react'
import { useModalState } from '@hooks/useModalState'
import { NotificationsIcon } from '@modules/notifications/components/NotificationsIcon'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { Drawer } from 'react-native-drawer-layout'
import { QRScannerView } from '@components/QRScannerView'
import { EmptyView } from '@components/EmptyView'
import { AccountOverview } from '@modules/accounts/components/AccountOverview'
import { AccountNfts } from '@modules/accounts/components/AccountNfts'
import { AccountHistory } from '@modules/accounts/components/AccountHistory'
import { TAB_ANIMATION_CONFIG } from '@constants/ui'
import { useLanguage } from '@hooks/useLanguage'
import { AccountStackParamsList } from '@modules/accounts/routes'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'

//TODO hook up all the button panel buttons correctly
//TODO implement more menu
//TODO figure out and implement banners/spot banners
//TODO implement nft and history tabs
//TODO implement account info screen somewhere (see old app top right corner)
//TODO implement rekey information && multisig information
type AccountScreenProps = NativeStackScreenProps<
    AccountStackParamsList,
    'AccountDetails'
>

export const AccountScreen = ({ route }: AccountScreenProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()
    const scannerState = useModalState()
    const drawerState = useModalState()
    const [tabIndex, setTabIndex] = useState(0)
    const { t } = useLanguage()
    const [playConfetti, setPlayConfetti] = useState(
        route.params?.playConfetti ?? false,
    )

    const { shouldPlayConfetti, setShouldPlayConfetti } =
        useShouldPlayConfetti()

    useEffect(() => {
        if (shouldPlayConfetti) {
            setPlayConfetti(true)
            setShouldPlayConfetti(false)
        }
    }, [shouldPlayConfetti, setShouldPlayConfetti])

    const toggleAccountSelectorVisible = () => {
        drawerState.open()
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
            open={drawerState.isOpen}
            onOpen={() => drawerState.open()}
            onClose={() => drawerState.close()}
            drawerType='front'
            swipeEnabled
            drawerStyle={styles.drawer}
            renderDrawerContent={() => (
                <AccountMenu
                    onSelected={() => drawerState.close()}
                    showInbox
                />
            )}
        >
            <ConfettiAnimation play={playConfetti} />
            <PWView style={styles.iconBar}>
                <PWView style={styles.iconBarSection}>
                    {/* TODO we may want to add support for pending inbox items here too
            (like the current inbox since we're using the same screen real estate) */}
                    <AccountSelection onPress={toggleAccountSelectorVisible} />
                </PWView>
                <PWView style={styles.iconBarSection}>
                    <PWTouchableOpacity onPress={scannerState.open}>
                        <PWIcon name='camera' />
                    </PWTouchableOpacity>
                    <NotificationsIcon />
                </PWView>
            </PWView>
            <PWTab
                value={tabIndex}
                onChange={e => setTabIndex(e)}
                containerStyle={styles.tabs}
                indicatorStyle={styles.indicator}
                titleStyle={styles.tabItem}
                dense
            >
                <PWTab.Item
                    title={t('account_details.main_screen.overview_tab')}
                />
                <PWTab.Item title={t('account_details.main_screen.nfts_tab')} />
                <PWTab.Item
                    title={t('account_details.main_screen.history_tab')}
                />
            </PWTab>
            <PWTabView
                value={tabIndex}
                onChange={setTabIndex}
                animationType='spring'
                animationConfig={TAB_ANIMATION_CONFIG}
            >
                <PWTabView.Item style={styles.fullWidth}>
                    <AccountOverview account={account} />
                </PWTabView.Item>
                <PWTabView.Item style={styles.fullWidth}>
                    <AccountNfts />
                </PWTabView.Item>
                <PWTabView.Item style={styles.fullWidth}>
                    <AccountHistory />
                </PWTabView.Item>
            </PWTabView>
            <QRScannerView
                isVisible={scannerState.isOpen}
                onSuccess={scannerState.close}
                onClose={scannerState.close}
                animationType='slide'
            />
        </Drawer>
    )
}
