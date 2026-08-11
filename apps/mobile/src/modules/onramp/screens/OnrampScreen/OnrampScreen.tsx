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

import { useCallback, useRef } from 'react'
import { ActivityIndicator } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import PagerView from 'react-native-pager-view'
import { useTheme } from '@rneui/themed'
import { useLanguage } from '@hooks/useLanguage'
import {
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
import { PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import {
    OnrampCountryChip,
    OnrampForm,
    OnrampHeaderTabs,
    OnrampHistoryContent,
    type OnrampTab,
} from '@modules/onramp/components'
import { useHasPendingRampOrders } from '@modules/onramp/hooks/useHasPendingRampOrders'
import { useStyles } from './styles'
import { useOnrampScreen } from './useOnrampScreen'

const ACCOUNT_TRIGGER_ICON_PROPS = { size: 'sm' } as const
const ACCOUNT_TRIGGER_CHEVRON_PROPS = { size: 'sm' } as const
const ACCOUNT_TRIGGER_TEXT_PROPS = { variant: 'body' } as const

// Pager page order mirrors the header tab order.
const TAB_PAGES: OnrampTab[] = ['fund', 'history']

export const OnrampScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()
    const { network } = useNetwork()
    const accounts = useAllAccounts()
    const onrampAccountFilter = useCallback(
        (account: WalletAccount) => canSignWith(account, accounts),
        [accounts],
    )
    const {
        isReady,
        pairsState,
        sourceToken,
        destinationToken,
        selectedPair,
        region,
        activeTab,
        handleTabChange,
        handleRegionInfoPress,
        handleRetryPairs,
    } = useOnrampScreen()

    const pagerRef = useRef<PagerView>(null)
    const hasPendingHistory = useHasPendingRampOrders()
    // The screen stays mounted in the navigator after navigating away, so tab
    // state alone would keep the history poll alive off-screen.
    const isFocused = useIsFocused()

    // Header tap drives the pager; the pager's onPageSelected then syncs the
    // active tab back (so swiping updates the header too).
    const handleHeaderTabChange = useCallback((tab: OnrampTab) => {
        pagerRef.current?.setPage(TAB_PAGES.indexOf(tab))
    }, [])

    const handleNavigateToHistory = useCallback(() => {
        pagerRef.current?.setPage(TAB_PAGES.indexOf('history'))
    }, [])

    const handlePageSelected = useCallback(
        (event: { nativeEvent: { position: number } }) => {
            handleTabChange(TAB_PAGES[event.nativeEvent.position])
        },
        [handleTabChange],
    )

    // Ramp is a mainnet-only feature (you're buying real crypto → ALGO), so on
    // testnet show an informational placeholder instead of the buy flow.
    if (network !== Networks.mainnet) {
        return (
            <PWView style={styles.screen}>
                <EmptyView
                    icon='info'
                    title={t('onramp.testnet.title')}
                    body={t('onramp.testnet.body')}
                />
            </PWView>
        )
    }

    return (
        <PWView
            style={styles.screen}
            testID='onramp-screen'
        >
            <PWView style={styles.header}>
                <PWView style={styles.headerRow}>
                    <OnrampCountryChip
                        countryCode={region?.countryCode}
                        onInfoPress={handleRegionInfoPress}
                    />
                    <AccountSelection
                        accountFilter={onrampAccountFilter}
                        triggerStyle={styles.accountTrigger}
                        triggerIconProps={ACCOUNT_TRIGGER_ICON_PROPS}
                        triggerChevronProps={ACCOUNT_TRIGGER_CHEVRON_PROPS}
                        triggerTextProps={ACCOUNT_TRIGGER_TEXT_PROPS}
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
                </PWView>

                <OnrampHeaderTabs
                    activeTab={activeTab}
                    onTabChange={handleHeaderTabChange}
                    badges={{ history: hasPendingHistory }}
                />
            </PWView>

            <PagerView
                ref={pagerRef}
                style={styles.pager}
                initialPage={0}
                onPageSelected={handlePageSelected}
            >
                <PWView
                    key='fund'
                    style={styles.page}
                >
                    {isReady ? (
                        <OnrampForm
                            sourceToken={sourceToken}
                            destinationToken={destinationToken}
                            selectedPair={selectedPair}
                            onNavigateToHistory={handleNavigateToHistory}
                        />
                    ) : (
                        <OfflineTolerantView
                            isOffline={pairsState === 'offline'}
                            isError={pairsState === 'error'}
                            onRetry={handleRetryPairs}
                        >
                            <PWView style={styles.loadingWrapper}>
                                <ActivityIndicator
                                    size='large'
                                    color={theme.colors.textMain}
                                />
                            </PWView>
                        </OfflineTolerantView>
                    )}
                </PWView>
                <PWView
                    key='history'
                    style={styles.page}
                >
                    <OnrampHistoryContent
                        isActive={activeTab === 'history' && isFocused}
                    />
                </PWView>
            </PagerView>
        </PWView>
    )
}
